import jwt from "jsonwebtoken";
const accessTokenGenerator = async (_id, role, name) => {
  return await jwt.sign(
    {
      _id: this._id,
      name: this.name,
      role: this.role,
    },
    process.env.process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

const refreshTokenGenerator = async (_id, role, name) => {
  return await jwt.sign(
    {
      _id: this._id,
      name: this.name,
      role: this.role,
    },
    process.env.process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export { accessTokenGenerator, refreshTokenGenerator };
