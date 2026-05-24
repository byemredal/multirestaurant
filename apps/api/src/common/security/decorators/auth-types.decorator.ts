import { SetMetadata } from '@nestjs/common';
import { AuthSubjectType } from '../auth-subject.type';
import { AUTH_TYPES_KEY } from '../constants';

export const AuthTypes = (...types: AuthSubjectType[]) =>
  SetMetadata(AUTH_TYPES_KEY, types);
