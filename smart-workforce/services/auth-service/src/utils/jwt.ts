import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const secret = process.env.JWT_SECRET as string;
const expireIn: number = +(process.env.JWT_EXPIRES_IN || 1500);

export const sign = (payload: object) =>
  jwt.sign(payload, secret, { expiresIn: expireIn });

export const verify = (token: string) => {
  const res = jwt.verify(token, secret);
  return res as JwtPayload;
};
