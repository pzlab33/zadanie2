const http = require('http');
const https = require('https');

const PORT = 8080;
const AUTHOR = "Piotr Zalewski";

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Punkt 1b: Prosty UI do wyboru miasta
    if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Aplikacja Pogodowa</h1>
                    <p>Autor: <b>${AUTHOR}</b></p>
                    <form action="/weather">
                        <select name="city" style="padding: 10px;">
                            <option value="Lublin">Lublin</option>
                            <option value="Warszawa">Warszawa</option>
                            <option value="Londyn">Londyn</option>
                            <option value="Nowy Jork">Nowy Jork</option>
                        </select>
                        <button type="submit" style="padding: 10px;">Sprawdź pogodę</button>
                    </form>
                </body>
            </html>
        `);
    }
    // Punkt 1b: Pobieranie danych pogodowych z zewnętrznego API (wttr.in)
    else if (url.pathname === '/weather') {
        const city = url.searchParams.get('city') || 'Lublin';
        https.get(`https://wttr.in/${city}?format=3`, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => data += chunk);
            apiRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <h2>Pogoda dla: ${city}</h2>
                    <p style="font-size: 24px;">${data}</p>
                    <a href="/">Powrót</a>
                `);
            });
        }).on('error', (err) => {
            res.end("Błąd połączenia z API pogodowym.");
        });
    }
});

// Punkt 1a: Informacja w logach przy starcie
server.listen(PORT, () => {
    const startDate = new Date().toISOString();
    console.log(`[${startDate}] Serwer uruchomiony.`);
    console.log(`Autor: ${AUTHOR}`);
    console.log(`Nasłuchiwanie na porcie TCP: ${PORT}`);
});
