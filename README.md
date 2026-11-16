# NIFTY50 Options Analytics Terminal

A quantitative options analytics prototype built using **Rust, HTML, CSS, and JavaScript**. The application calculates theoretical NIFTY50 call option prices using the Binomial Option Pricing Model (BOPM) and compares them with historical NSE market data.

## Features

- **NIFTY50 Market Data:** Reads historical spot price and call option premium from an NSE derivatives Bhavcopy CSV file.
- **Binomial Option Pricing Model:** Calculates theoretical European call option prices using a Rust pricing engine.
- **Market vs Model Comparison:** Compares the historical closing premium with the calculated theoretical price.
- **Volatility Sensitivity Analysis:** Visualizes how changes in volatility affect theoretical option prices.
- **Option Chain Analytics:** Fetches end-of-day option-chain analytics from the AFI Codes API.
- **Interactive Dashboard:** Displays market information, calculations, and charts through a web-based frontend.

## Technologies Used

| Technology | Purpose |
|---|---|
| Rust | Backend and BOPM pricing engine |
| HTML | Dashboard structure |
| CSS | Dashboard styling |
| JavaScript | Frontend logic and API integration |
| Chart.js | Data visualization |
| AFI Codes API | End-of-day option-chain analytics |
| NSE Bhavcopy | Historical derivatives market data |

## Project Structure

```text
nifty_bopm/
├── data/
│   └── BhavCopy_NSE_FO_0_0_0_20261113_F_0000.csv
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── src/
│   └── main.rs
├── Cargo.toml
├── Cargo.lock
└── .gitignore
```

## How to Run

### 1. Clone the repository

```bash
git clone https://github.com/lakshmipriyaj-gct/nifty50-options-analytics.git
cd nifty50-options-analytics
```

### 2. Configure the AFI Codes API key

Set your API key in PowerShell:

```powershell
$env:AFI_API_KEY = Read-Host "Enter your AFI API key"
```

### 3. Start the Rust backend

```bash
cargo run
```

The backend runs at:

```text
http://127.0.0.1:3030
```

### 4. Launch the frontend

Open `frontend/index.html` using the VS Code Live Server extension.

## Binomial Option Pricing Model

The project uses the Cox-Ross-Rubinstein (CRR) binomial model to estimate a European call option's theoretical value.

The model uses:

- Spot price (S)
- Strike price (K)
- Volatility (σ)
- Risk-free interest rate (r)
- Time to expiry (T)
- Number of binomial tree steps (N)

The theoretical price is calculated through backward induction using risk-neutral probabilities.

## Data and Model Notes

- The NSE Bhavcopy data used in the dashboard is historical, dated 13 November 2026.
- The AFI Codes integration provides end-of-day option-chain analytics, including implied volatility and Greeks. It does not provide actual option premiums through the integrated endpoint.
- The BOPM theoretical price depends on the selected model assumptions and input parameters.
- This project is an academic prototype and does not provide live trading or investment recommendations.

## Author

**Lakshmipriya J**

Electronics and Communication Engineering

GitHub: [lakshmipriyaj-gct](https://github.com/lakshmipriyaj-gct)
