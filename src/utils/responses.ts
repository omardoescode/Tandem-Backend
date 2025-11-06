interface SuccessResponse<T> {
  success: true;
  data?: T;
}

export const SuccessResponse = <T>(data?: T): SuccessResponse<T> => ({
  success: true,
  data,
});

interface ErrorResponse<E> {
  success: false;
  error: E;
}

export const ErrorResponse = <T>(error: T): ErrorResponse<T> => ({
  success: false,
  error,
});
