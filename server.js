// server.js (versión con OAuth 2.0)
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const REDIRECT_URI = `http://localhost:3000/oauth-callback`;
const CHROME_EXTENSION_URL = process.env.CHROME_EXTENSION_URL;

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
    // 1. Define todos los scopes que necesitas en un array.
    //    Esto hace que sea mucho más fácil de leer y mantener.
    const scopes = [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write'
        // Puedes agregar más scopes aquí en el futuro, por ejemplo:
        // 'crm.objects.companies.read'
    ];

    // 2. Une el array en un solo string separado por espacios.
    const scopeString = scopes.join(' ');

    // 3. Construye la URL de autorización usando el nuevo string de scopes.
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
        // En una app real, guardarías los tokens en una base de datos asociados al usuario.
        // Por simplicidad, los devolvemos en la URL para que la extensión los capture.
        res.redirect(`${CHROME_EXTENSION_URL}/oauth-redirect.html?access_token=${access_token}&refresh_token=${refresh_token}`);

    } catch (error) {
        console.error('Error al intercambiar el código por token:', error.response ? error.response.data : error.message);
        res.status(500).send('Hubo un error al autenticar con HubSpot.');
    }
});

// Endpoint 3: Búsqueda de contactos (modificado para usar el token del usuario)
app.post('/search-contact', async (req, res) => {
    const { email } = req.body;
    const accessToken = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

    if (!accessToken) {
        return res.status(401).json({ message: 'No autenticado. Falta el token de acceso.' });
    }

    const hubspotApiUrl = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
    const requestPayload = {
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email', 'firstname', 'lastname'],
        limit: 1
    };

    try {
        const apiResponse = await axios.post(hubspotApiUrl, requestPayload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        res.json(apiResponse.data);
    } catch (error) {
        console.error('Error en API de HubSpot:', error.response ? error.response.data : error.message);
        res.status(error.response.status).json(error.response.data);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy escuchando en http://localhost:${PORT}`);
});