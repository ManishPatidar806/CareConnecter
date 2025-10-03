import { accessTokenGenerator, refreshTokenGenerator } from './JwtGenerator.js';
import ApiResponse from './ApiResponse.js';
import bcrypt from 'bcrypt';

export const issueAuthTokens = async ({ user, role, res, message = 'Authenticated successfully' }) => {
  const accessToken = await accessTokenGenerator(user._id, role, user.name);
  const refreshToken = await refreshTokenGenerator(user._id, role, user.name);
  // Store hashed refresh token for security (supports migration: if existing plain token exists keep it until rotated)
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();

  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
  };
  res
    .cookie('accesstoken', accessToken, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .cookie('refreshtoken', refreshToken, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });

  const safeUser = await user.constructor.findById(user._id).select('-password -refreshToken');
  return res.status(200).json(new ApiResponse(200, message, {
    user: safeUser,
    accessToken,
    refreshToken,
  }));
};

export const rotateRefreshToken = async ({ model, token, res }) => {
  // Try hashed comparison across all users (inefficient for very large collections; acceptable here). Better: store tokenID or jti.
  const candidates = await model.find({ refreshToken: { $ne: null } }).select('+refreshToken');
  let existingUser = null;
  for (const cand of candidates) {
    if (cand.refreshToken && (await bcrypt.compare(token, cand.refreshToken))) {
      existingUser = cand;
      break;
    }
    // Backward compatibility: direct equality (legacy plain storage)
    if (cand.refreshToken === token) {
      existingUser = cand;
      break;
    }
  }
  if (!existingUser) return null;
  const newAccess = await accessTokenGenerator(existingUser._id, existingUser.role || model.modelName.toLowerCase(), existingUser.name);
  const newRefresh = await refreshTokenGenerator(existingUser._id, existingUser.role || model.modelName.toLowerCase(), existingUser.name);
  existingUser.refreshToken = await bcrypt.hash(newRefresh, 10);
  await existingUser.save();
  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'None' };
  res
    .cookie('accesstoken', newAccess, { ...cookieOpts, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .cookie('refreshtoken', newRefresh, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });
  const safeUser = await model.findById(existingUser._id).select('-password -refreshToken');
  return { accessToken: newAccess, refreshToken: newRefresh, user: safeUser };
};
