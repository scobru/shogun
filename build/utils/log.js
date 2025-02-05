export const log = (message, value) => {
    if (!value)
        return console.log(message);
    console.log(message, value);
};
export const error = (message, value) => {
    if (!value)
        return console.error(message);
    console.error(message, value);
};
export const info = (message, value) => {
    if (!value)
        return console.info(message);
    console.info(message, value);
};
