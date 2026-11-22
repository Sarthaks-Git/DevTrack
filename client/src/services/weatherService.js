import api from './api';

// Weather theme. The server asks MET Norway, so the browser never contacts a weather service.
export const getWeather = ({ lat, lon }) => api.get('/weather', { params: { lat, lon } }).then(response => response.data.data);
