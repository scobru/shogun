export const log = (message: string, value?: any) => {
  if( !value ) return console.log(message)
  console.log(message, value);
};

export const error = (message: string, value?: any) => {
  if( !value ) return console.error(message)
  console.error(message, value);
};

export const info = (message: string, value?: any) => {
  if( !value ) return console.info(message)
  console.info(message, value);
};


