import { NextFunction, Request, Response } from 'express';
import * as authService from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json(await authService.registerUser(req.body));
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await authService.loginUser(req.body));
  } catch (err) {
    next(err);
  }
}
