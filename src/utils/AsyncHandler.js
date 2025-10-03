

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    console.error(`Error Occured At AsyncHandler: ${error}`);
    next(error);
  }
};

export default asyncHandler;
