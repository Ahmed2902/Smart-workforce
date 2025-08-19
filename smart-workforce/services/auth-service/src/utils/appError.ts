class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // This line ensures that the correct prototype chain is maintained
    // for all instances of AppError.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export default AppError;
