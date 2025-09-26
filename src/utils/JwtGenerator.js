import jwt from "jsonwebtoken";
const accessTokenGenerator = async (_id, role, name) => {
  return await jwt.sign(
    {
      _id: _id,
      name: name,
      role: role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

const refreshTokenGenerator = async (_id, role, name) => {
  return await jwt.sign(
    {
      _id: _id,
      name: name,
      role: role,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export { accessTokenGenerator, refreshTokenGenerator };
