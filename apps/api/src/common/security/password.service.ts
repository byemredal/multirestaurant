import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash as hashPassword } from 'bcryptjs';

@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  async hash(value: string): Promise<string> {
    const saltRounds = this.configService.get<number>('auth.passwordSaltRounds', 10);
    return hashPassword(value, saltRounds);
  }

  async matches(value: string, passwordHash: string): Promise<boolean> {
    return compare(value, passwordHash);
  }
}
