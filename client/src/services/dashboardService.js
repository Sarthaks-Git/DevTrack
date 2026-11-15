import api from './api';
import { localDayKey } from '../utils/localDay';

export async function getAttention() {
  const { data } = await api.get('/dashboard/attention', { params: { today: localDayKey() } });
  return data.data;
}
