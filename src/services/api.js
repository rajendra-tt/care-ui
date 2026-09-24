import { config } from './config';
import { crioHttp } from './crioHttp';
import { crioMock } from './crioMock';

export const api = config.mode === 'crio' ? crioHttp : crioMock;
export const isMock = config.mode !== 'crio';
