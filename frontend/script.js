
// ==========================================
// NIFTY50 OPTIONS ANALYTICS TERMINAL
// FRONTEND JAVASCRIPT
// ==========================================

// Rust backend endpoints
const API_URL = "http://127.0.0.1:3030/calculate";
const OPTIONS_API_URL = "http://127.0.0.1:3030/options";
const MARKET_DATA_API_URL = "http://127.0.0.1:3030/market-data";

// NSE market data loaded dynamically
let marketData = null;

// ==========================================
// DISPLAY CURRENT DATE
// ==========================================

const dateElement = document.getElementById("currentDate");

if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ==========================================
// CHART 1: MARKET VS BOPM COMPARISON
// ==========================================

const comparisonCtx = document
    .getElementById("comparisonChart")
    .getContext("2d");

const comparisonChart = new Chart(comparisonCtx, {
    type: "bar",

    data: {
        labels: ["Market Premium", "BOPM Price"],

        datasets: [{
            label: "Option Price (₹)",
            data: [null, null],
            backgroundColor: ["#38bdf8", "#a78bfa"],
            borderRadius: 6
        }]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
            legend: {
                labels: {
                    color: "#e5e7eb"
                }
            }
        },

        scales: {
            x: {
                ticks: {
                    color: "#94a3b8"
                },
                grid: {
                    color: "#263244"
                }
            },

            y: {
                beginAtZero: true,
                ticks: {
                    color: "#94a3b8"
                },
                grid: {
                    color: "#263244"
                }
            }
        }
    }
});

// ==========================================
// CHART 2: VOLATILITY SENSITIVITY
// ==========================================

const volatilityCtx = document
    .getElementById("volatilityChart")
    .getContext("2d");

const volatilityChart = new Chart(volatilityCtx, {
    type: "line",

    data: {
        labels: [],

        datasets: [{
            label: "Theoretical Call Price (₹)",
            data: [],
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            fill: true,
            tension: 0.3
        }]
    },

    options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
            legend: {
                labels: {
                    color: "#e5e7eb"
                }
            }
        },

        scales: {
            x: {
                title: {
                    display: true,
                    text: "Volatility (%)",
                    color: "#94a3b8"
                },

                ticks: {
                    color: "#94a3b8"
                }
            },

            y: {
                beginAtZero: true,

                title: {
                    display: true,
                    text: "Option Price (₹)",
                    color: "#94a3b8"
                },

                ticks: {
                    color: "#94a3b8"
                }
            }
        }
    }
});

// ==========================================
// BOPM CALCULATION USING RUST
// ==========================================

async function calculateBOPM(
    spot,
    strike,
    volatility,
    rate,
    days,
    steps
) {
    const response = await fetch(API_URL, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            spot: spot,
            strike: strike,
            volatility: volatility / 100,
            rate: rate / 100,
            days: days,
            steps: steps
        })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(
            result.error || "BOPM calculation failed"
        );
    }

    return result.theoretical_price;
}

// ==========================================
// FETCH NSE MARKET DATA FROM RUST
// ==========================================

async function loadMarketData() {

    const response = await fetch(MARKET_DATA_API_URL);
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(
            result.error || "Unable to load NSE market data"
        );
    }

    marketData = {
        symbol: result.symbol,
        strike: Number(result.strike),
        optionType: result.option_type,
        expiry: result.expiry,
        tradingDate: result.trading_date,
        spot: Number(result.spot),
        closingPremium: Number(result.closing_premium),
        lastTradedPrice: Number(result.last_traded_price),
        volume: Number(result.volume)
    };

    // Update calculator inputs
    document.getElementById("spot").value = marketData.spot;
    document.getElementById("strike").value = marketData.strike;

    // Update spot price
    document.getElementById("spotPrice").textContent =
        marketData.spot.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    // Update actual market premium
    document.getElementById("marketPremium").textContent =
        "₹" + marketData.closingPremium.toFixed(2);

    // Update comparison card
    document.getElementById("comparisonMarket").textContent =
        "₹" + marketData.closingPremium.toFixed(2);

    // Update comparison chart
    comparisonChart.data.datasets[0].data = [
        marketData.closingPremium,
        null
    ];

    comparisonChart.update();

    console.log("NSE market data loaded:", marketData);
}

// ==========================================
// CHECK HISTORICAL CONTRACT MATCH
// ==========================================

function matchesHistoricalContract(spot, strike, days) {

    if (!marketData) {
        return false;
    }

    const spotMatches =
        Math.abs(spot - marketData.spot) < 0.01;

    const strikeMatches =
        Math.abs(strike - marketData.strike) < 0.01;

    const expiryMatches = days === 4;

    return spotMatches && strikeMatches && expiryMatches;
}

// ==========================================
// CALCULATE BUTTON
// ==========================================

const calculateBtn = document.getElementById("calculateBtn");

calculateBtn.addEventListener("click", async function () {

    const message =
        document.getElementById("calculatorMessage");

    const spot = Number(document.getElementById("spot").value);
    const strike = Number(document.getElementById("strike").value);
    const volatility = Number(document.getElementById("volatility").value);
    const rate = Number(document.getElementById("rate").value);
    const days = Number(document.getElementById("days").value);
    const steps = Number(document.getElementById("steps").value);

    // Validate inputs
    if (
        !Number.isFinite(spot) ||
        !Number.isFinite(strike) ||
        !Number.isFinite(volatility) ||
        !Number.isFinite(rate) ||
        !Number.isFinite(days) ||
        !Number.isInteger(steps) ||
        spot <= 0 ||
        strike <= 0 ||
        volatility <= 0 ||
        days <= 0 ||
        steps <= 0 ||
        steps > 10000
    ) {
        message.textContent =
            "Please enter valid values. Steps must be between 1 and 10000.";

        return;
    }

    try {

        calculateBtn.disabled = true;
        calculateBtn.textContent = "Calculating...";

        if (!marketData) {
            throw new Error(
                "NSE market data has not loaded. Refresh the dashboard."
            );
        }

        message.textContent =
            "Connecting to Rust BOPM engine...";

        // Calculate theoretical price
        const theoreticalPrice = await calculateBOPM(
            spot,
            strike,
            volatility,
            rate,
            days,
            steps
        );

        // Update spot and model summary
        document.getElementById("spotPrice").textContent =
            spot.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        document.getElementById("modelPrice").textContent =
            "₹" + theoreticalPrice.toFixed(2);

        // Market vs model comparison
        if (matchesHistoricalContract(spot, strike, days)) {

            const marketPremium = marketData.closingPremium;

            const difference =
                marketPremium - theoreticalPrice;

            const absoluteDifference =
                Math.abs(difference);

            document.getElementById("marketPremium").textContent =
                "₹" + marketPremium.toFixed(2);

            document.getElementById("priceDifference").textContent =
                "₹" + difference.toFixed(2);

            document.getElementById("comparisonMarket").textContent =
                "₹" + marketPremium.toFixed(2);

            document.getElementById("comparisonModel").textContent =
                "₹" + theoreticalPrice.toFixed(2);

            document.getElementById("absoluteDifference").textContent =
                "₹" + absoluteDifference.toFixed(2);

            comparisonChart.data.datasets[0].data = [
                marketPremium,
                theoreticalPrice
            ];

            comparisonChart.update();

            message.textContent =
                "Historical comparison successful! " +
                "Market premium: ₹" + marketPremium.toFixed(2) +
                ", BOPM price: ₹" + theoreticalPrice.toFixed(2) +
                ", Difference: ₹" + difference.toFixed(2) +
                ". Model volatility assumption: " + volatility + "%.";

        } else {

            document.getElementById("marketPremium").textContent =
                "Contract mismatch";

            document.getElementById("priceDifference").textContent =
                "Not available";

            document.getElementById("comparisonMarket").textContent =
                "Not matched";

            document.getElementById("comparisonModel").textContent =
                "₹" + theoreticalPrice.toFixed(2);

            document.getElementById("absoluteDifference").textContent =
                "Not available";

            comparisonChart.data.datasets[0].data = [
                null,
                theoreticalPrice
            ];

            comparisonChart.update();

            message.textContent =
                "BOPM calculated successfully. Inputs do not match " +
                "the historical NIFTY 25150 CE contract. " +
                "Use spot " + marketData.spot +
                ", strike " + marketData.strike +
                " and 4 days to compare with the historical premium.";
        }

        // Volatility sensitivity analysis
        message.textContent +=
            " Calculating volatility sensitivity...";

        const volatilityLevels = [10, 15, 18, 20, 25, 30];

        const sensitivityPrices = [];

        for (const vol of volatilityLevels) {

            const price = await calculateBOPM(
                spot,
                strike,
                vol,
                rate,
                days,
                steps
            );

            sensitivityPrices.push(price);
        }

        volatilityChart.data.labels =
            volatilityLevels.map(value => value + "%");

        volatilityChart.data.datasets[0].data =
            sensitivityPrices;

        volatilityChart.update();

        message.textContent +=
            " Volatility sensitivity analysis completed.";

    } catch (error) {

        console.error("BOPM API Error:", error);

        message.textContent =
            "Error: " + error.message +
            ". Make sure the Rust server is running.";

    } finally {

        calculateBtn.disabled = false;
        calculateBtn.textContent = "Calculate Call Price";
    }
});

// ==========================================
// FETCH AFI CODES OPTION-CHAIN DATA
// ==========================================

const fetchOptionsBtn =
    document.getElementById("fetchOptionsBtn");

fetchOptionsBtn.addEventListener("click", async function () {

    const message =
        document.getElementById("optionChainMessage");

    const date =
        document.getElementById("optionDate").value;

    const windowSize =
        Number(document.getElementById("optionWindow").value);

    if (!date) {
        message.textContent = "Please select a date.";
        return;
    }

    if (
        !Number.isInteger(windowSize) ||
        windowSize < 1 ||
        windowSize > 10
    ) {
        message.textContent =
            "Window must be between 1 and 10.";

        return;
    }

    try {

        fetchOptionsBtn.disabled = true;
        fetchOptionsBtn.textContent = "Fetching data...";

        message.textContent =
            "Connecting to AFI Codes through Rust...";

        const url =
            `${OPTIONS_API_URL}?date=${encodeURIComponent(date)}&window=${windowSize}`;

        const response = await fetch(url);

        const result = await response.json();

        // IMPORTANT:
        // Check HTTP status only.
        // AFI response does not necessarily contain a "success" field.

        if (!response.ok) {
            throw new Error(
                result.error || "Unable to fetch AFI option data"
            );
        }

        // Validate the returned data structure
        const options = Array.isArray(result.data)
            ? result.data
            : [];

        // Update summary cards
        document.getElementById("atmStrike").textContent =
            result.atm_strike ?? "--";

        document.getElementById("optionCount").textContent =
            result.count ?? options.length;

        document.getElementById("optionDataDate").textContent =
            result.date ?? date;

        // Display option-chain records
        displayOptionChain(options);

        if (options.length === 0) {

            message.textContent =
                "API request succeeded, but no option records were returned.";

        } else {

            message.textContent =
                `Successfully fetched ${options.length} option records from AFI Codes.`;
        }

        console.log("AFI Codes response:", result);

    } catch (error) {

        console.error("AFI API Error:", error);

        message.textContent =
            "Error: " + error.message +
            ". Check the Rust server and AFI API key.";

    } finally {

        fetchOptionsBtn.disabled = false;
        fetchOptionsBtn.textContent = "Fetch NIFTY Option Chain";
    }
});

// ==========================================
// DISPLAY AFI OPTION-CHAIN TABLE
// ==========================================

function displayOptionChain(options) {

    const tableBody =
        document.getElementById("optionChainBody");

    tableBody.innerHTML = "";

    if (!options || options.length === 0) {

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.textContent = "No option-chain records available.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        return;
    }

    options.forEach(option => {

        const row = document.createElement("tr");

        const callIV =
            Number(option.call_iv) * 100;

        const putIV =
            Number(option.put_iv) * 100;

        const values = [
            option.strike,
            Number.isFinite(callIV) ? callIV.toFixed(2) + "%" : "--",
            formatNumber(option.call_delta, 4),
            Number.isFinite(putIV) ? putIV.toFixed(2) + "%" : "--",
            formatNumber(option.put_delta, 4),
            formatNumber(option.gamma, 7),
            formatNumber(option.theta, 4),
            formatNumber(option.spread_bps, 2),
            option.tradable ? "Yes" : "No"
        ];

        values.forEach(value => {

            const cell = document.createElement("td");

            cell.textContent = value ?? "--";

            row.appendChild(cell);
        });

        tableBody.appendChild(row);
    });
}

// ==========================================
// FORMAT NUMBERS
// ==========================================

function formatNumber(value, decimals) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return number.toFixed(decimals);
}

// ==========================================
// INITIALIZE FRONTEND
// ==========================================

async function initializeDashboard() {

    try {

        console.log("Loading NIFTY50 market data...");

        await loadMarketData();

        document.getElementById("comparisonModel").textContent =
            "--";

        document.getElementById("priceDifference").textContent =
            "--";

        document.getElementById("absoluteDifference").textContent =
            "--";

        document.getElementById("modelPrice").textContent =
            "--";

        console.log("NIFTY50 dashboard initialized successfully.");
        console.log("Historical market data:", marketData);
        console.log("Rust BOPM API:", API_URL);
        console.log("Rust AFI API:", OPTIONS_API_URL);

    } catch (error) {

        console.error("Market data loading error:", error);

        document.getElementById("marketPremium").textContent =
            "Data unavailable";

        document.getElementById("spotPrice").textContent =
            "Data unavailable";

        document.getElementById("calculatorMessage").textContent =
            "Unable to load NSE market data: " + error.message;
    }
}

// Start dashboard
initializeDashboard();
