# Invoice App

A simple static web app for generating invoices and PDFs.

## Local Run

Using Python:
```powershell
cd "c:\Users\udith\Desktop\invoice-app"
python -m http.server 5500
```
Open `http://localhost:5500/`.

Using Node.js:
```powershell
cd "c:\Users\udith\Desktop\invoice-app"
npx serve -l 5500
```
Open `http://localhost:5500/`.

## Cash Handling (to be added)
- Record cash tendered
- Auto-calc change due
- Validate sufficient payment

## Project Structure
```
index.html
css/
  style.css
js/
  app.js
  pdf-generator.js
  router.js
  store.js
```

## License
Proprietary. Do not redistribute without permission.
