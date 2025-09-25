const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    console.error(`Error Occured At : ${error}`);
  }
};

export default asyncHandler;
