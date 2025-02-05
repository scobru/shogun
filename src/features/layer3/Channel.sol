// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title PaymentChannel
/// @notice Gestisce un canale di micropagamenti off-chain con riconciliazione on-chain.
/// @dev Utilizza custom errors e variabili immutable per ottimizzare il gas. In fase di produzione, 
///      si può estendere il contratto per includere meccanismi di fee/incentivi per i relay.
contract PaymentChannel {
    // --- Custom Errors per ottimizzare il gas ---
    error InsufficientDeposit();
    error AlreadyClosing();
    error NotClosing();
    error InvalidState();
    error NonceTooLow();
    error ChallengeExpired();
    error AlreadyWithdrawn();
    error InvalidSignature();

    // --- Variabili immutable ---
    address public immutable client;
    address public immutable relay;
    uint256 public immutable deposit;
    uint256 public immutable challengePeriod; // Durata del challenge period in secondi

    // Stato migliore registrato (saldi e nonce)
    uint256 public bestNonce;
    uint256 public bestClientBalance;
    uint256 public bestRelayBalance;

    // Variabili per la gestione del challenge period
    uint256 public closingTime; // Timestamp in cui il challenge termina
    bool public isClosing;
    address public closer; // Chi ha avviato la chiusura

    // Flag per evitare doppie riscossioni
    bool public withdrawn;

    // --- Eventi ---
    event ChannelOpened(address indexed client, address indexed relay, uint256 deposit);
    event ChannelClosed(uint256 clientBalance, uint256 relayBalance, uint256 nonce);
    event ChallengeUpdated(uint256 clientBalance, uint256 relayBalance, uint256 nonce);
    event ChannelFinalized(uint256 clientBalance, uint256 relayBalance);

    /// @notice Il canale si apre al deploy con un deposito da parte del client.
    /// @param _relay L'indirizzo del relay.
    /// @param _challengePeriod Durata del challenge period in secondi.
    constructor(address _relay, uint256 _challengePeriod) payable {
        if (msg.value == 0) revert InsufficientDeposit();
        client = msg.sender;
        relay = _relay;
        deposit = msg.value;
        challengePeriod = _challengePeriod;

        bestNonce = 0;
        bestClientBalance = deposit;
        bestRelayBalance = 0;
        isClosing = false;
        withdrawn = false;

        emit ChannelOpened(client, relay, deposit);
    }

    /// @notice Avvia la chiusura del canale fornendo uno stato off-chain firmato.
    /// @param clientBalance Saldo off-chain del client.
    /// @param relayBalance Saldo off-chain del relay.
    /// @param nonce Stato off-chain rappresentato da un nonce crescente.
    /// @param clientSig Firma del client sullo stato.
    /// @param relaySig Firma del relay sullo stato.
    function closeChannel(
        uint256 clientBalance,
        uint256 relayBalance,
        uint256 nonce,
        bytes memory clientSig,
        bytes memory relaySig
    ) external {
        if (isClosing) revert AlreadyClosing();
        if (clientBalance + relayBalance != deposit) revert InvalidState();
        if (nonce <= bestNonce) revert NonceTooLow();

        // Costruiamo il messaggio da verificare
        bytes32 stateHash = keccak256(abi.encodePacked(address(this), clientBalance, relayBalance, nonce));
        bytes32 ethSignedMessageHash = prefixed(stateHash);

        if (recoverSigner(ethSignedMessageHash, clientSig) != client) revert InvalidSignature();
        if (recoverSigner(ethSignedMessageHash, relaySig) != relay) revert InvalidSignature();

        bestNonce = nonce;
        bestClientBalance = clientBalance;
        bestRelayBalance = relayBalance;

        isClosing = true;
        closingTime = block.timestamp + challengePeriod;
        closer = msg.sender;

        emit ChannelClosed(clientBalance, relayBalance, nonce);
    }

    /// @notice Aggiorna lo stato del canale durante il challenge period.
    function updateState(
        uint256 clientBalance,
        uint256 relayBalance,
        uint256 nonce,
        bytes memory clientSig,
        bytes memory relaySig
    ) external {
        if (!isClosing) revert NotClosing();
        if (block.timestamp >= closingTime) revert ChallengeExpired();
        if (clientBalance + relayBalance != deposit) revert InvalidState();
        if (nonce <= bestNonce) revert NonceTooLow();

        bytes32 stateHash = keccak256(abi.encodePacked(address(this), clientBalance, relayBalance, nonce));
        bytes32 ethSignedMessageHash = prefixed(stateHash);

        if (recoverSigner(ethSignedMessageHash, clientSig) != client) revert InvalidSignature();
        if (recoverSigner(ethSignedMessageHash, relaySig) != relay) revert InvalidSignature();

        bestNonce = nonce;
        bestClientBalance = clientBalance;
        bestRelayBalance = relayBalance;

        // Estende il challenge period
        closingTime = block.timestamp + challengePeriod;

        emit ChallengeUpdated(clientBalance, relayBalance, nonce);
    }

    /// @notice Finalizza il canale dopo il challenge period e distribuisce i fondi.
    function finalizeChannel() external {
        if (!isClosing) revert NotClosing();
        if (block.timestamp < closingTime) revert ChallengeExpired();
        if (withdrawn) revert AlreadyWithdrawn();

        withdrawn = true;
        payable(client).transfer(bestClientBalance);
        payable(relay).transfer(bestRelayBalance);

        emit ChannelFinalized(bestClientBalance, bestRelayBalance);
    }

    // --- Funzioni helper per la gestione delle firme ---

    /// @notice Recupera l'indirizzo del firmatario da un messaggio firmato.
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) public pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(_signature);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    /// @notice Divide una firma in componenti (v, r, s).
    function splitSignature(bytes memory sig) public pure returns (uint8, bytes32, bytes32) {
        if (sig.length != 65) revert InvalidSignature();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return (v, r, s);
    }

    /// @notice Aggiunge il prefisso standard Ethereum al messaggio da firmare.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
