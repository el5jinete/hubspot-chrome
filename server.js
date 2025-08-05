// server.js (versión para producción)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config(); // Esto es útil para desarrollo local

const app = express();
// La plataforma de hosting (Render, Heroku) nos dará el puerto a través de process.env.PORT
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
// ¡IMPORTANTE! Este URI debe coincidir con el que configures en tu App de HubSpot
// y debe usar la URL pública de tu servidor.
const REDIRECT_URI = process.env.SERVER_URL + '/oauth-callback';
const CHROME_EXTENSION_URL = process.env.CHROME_EXTENSION_URL;

// Recomendación: Define una nueva variable de entorno SERVER_URL en tu hosting
// Por ej: SERVER_URL = https://mi-servidor-hubspot.onrender.com

// El resto de tu código permanece exactamente igual...

// Configuración de CORS más específica
const corsOptions = {
    origin: CHROME_EXTENSION_URL, // Solo permite peticiones de tu extensión
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Endpoint 1: Iniciar el proceso de autenticación
app.get('/auth', (req, res) => {
    const scopes = [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write'
    ];
    const scopeString = scopes.join(' ');
    const hubspotAuthUrl = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopeString)}`;
    res.json({ authUrl: hubspotAuthUrl });
});

// Endpoint 2: Callback de HubSpot después del login
app.get('/oauth-callback', async (req, res) => {
    const authCode = req.query.code;
    if (!authCode) {
        return res.status(400).send('Error: No se recibió el código de autorización.');
    }
    try {
        const response = await axios.post('https://api.hubapi.com/oauth/v1/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code: authCode
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const { access_token, refresh_token } = response.data;
        res.redirect(`${CHROME_EXTENSION_URL}/oauth-redirect.html?access_token=${access_token}&refresh_token=${refresh_token}`);
    } catch (error) {
        console.error('Error al intercambiar el código por token:', error.response ? error.response.data : error.message);
        res.status(500).send('Hubo un error al autenticar con HubSpot.');
    }
});

// Endpoint 3: Búsqueda de contactos
app.post('/search-contact', async (req, res) => {
    // ... tu código de búsqueda no necesita cambios
});

app.listen(PORT, () => {
    // Este log ahora aparecerá en los logs de tu plataforma de hosting
    console.log(`Servidor proxy escuchando en el puerto ${PORT}`);
});
