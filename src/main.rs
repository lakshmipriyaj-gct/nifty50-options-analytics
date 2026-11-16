
use std::env;
use std::io::Read;

use serde_json::{json, Value};
use tiny_http::{Header, Response, Server};

// ==========================================
// CONFIGURATION
// ==========================================

const CSV_FILE: &str =
    "data/BhavCopy_NSE_FO_0_0_0_20261113_F_0000.csv";

// ==========================================
// MAIN SERVER
// ==========================================

fn main() {
    let server = Server::http("127.0.0.1:3030")
        .expect("Failed to start Rust server");

    println!("======================================");
    println!("     NIFTY50 OPTIONS ANALYTICS");
    println!("======================================");
    println!("Server: http://127.0.0.1:3030");
    println!("Waiting for requests...");

    for mut request in server.incoming_requests() {
        // CORS preflight
        if request.method().as_str() == "OPTIONS" {
            let response = Response::from_string("")
                .with_header(Header::from_bytes(
                    "Access-Control-Allow-Origin", "*"
                ).unwrap())
                .with_header(Header::from_bytes(
                    "Access-Control-Allow-Methods",
                    "GET, POST, OPTIONS"
                ).unwrap())
                .with_header(Header::from_bytes(
                    "Access-Control-Allow-Headers", "Content-Type"
                ).unwrap());

            let _ = request.respond(response);
            continue;
        }

        let request_url = request.url().to_string();

        // ======================================
        // NSE CSV MARKET DATA ENDPOINT
        // GET /market-data
        // ======================================

        if request.method().as_str() == "GET"
            && request_url.starts_with("/market-data")
        {
            match fetch_market_data_from_csv() {
                Ok(data) => {
                    println!("NSE CSV market data loaded");
                    send_json(request, data, 200);
                }
                Err(error) => {
                    eprintln!("CSV error: {}", error);

                    send_json(
                        request,
                        json!({
                            "success": false,
                            "error": error
                        }),
                        500,
                    );
                }
            }

            continue;
        }

        // ======================================
        // AFI CODES OPTION-CHAIN ENDPOINT
        // GET /options?date=YYYY-MM-DD&window=1
        // ======================================

        if request.method().as_str() == "GET"
            && request_url.starts_with("/options")
        {
            let query = request_url
                .split_once('?')
                .map(|(_, q)| q)
                .unwrap_or("");

            let mut date: Option<String> = None;
            let mut window: u32 = 1;

            for parameter in query.split('&') {
                let mut parts = parameter.splitn(2, '=');

                let key = parts.next().unwrap_or("");
                let value = parts.next().unwrap_or("");

                match key {
                    "date" => date = Some(value.to_string()),
                    "window" => {
                        window = value.parse().unwrap_or(1);
                    }
                    _ => {}
                }
            }

            if window == 0 || window > 10 {
                send_json(
                    request,
                    json!({
                        "success": false,
                        "error": "Window must be between 1 and 10"
                    }),
                    400,
                );
                continue;
            }

            match date {
                Some(date) => {
                    match fetch_afi_options(&date, window) {
                        Ok(data) => {
                            println!(
                                "AFI option-chain data fetched: {}",
                                date
                            );
                            send_json(request, data, 200);
                        }
                        Err(error) => {
                            eprintln!("AFI API error: {}", error);

                            send_json(
                                request,
                                json!({
                                    "success": false,
                                    "error": error
                                }),
                                502,
                            );
                        }
                    }
                }

                None => {
                    send_json(
                        request,
                        json!({
                            "success": false,
                            "error": "Missing date parameter"
                        }),
                        400,
                    );
                }
            }

            continue;
        }

        // ======================================
        // BOPM CALCULATION ENDPOINT
        // POST /calculate
        // ======================================

        if request.method().as_str() != "POST"
            || request.url() != "/calculate"
        {
            send_json(
                request,
                json!({
                    "success": false,
                    "error": "Invalid API endpoint"
                }),
                404,
            );
            continue;
        }

        // Read request body
        let mut body = String::new();

        if let Err(error) =
            request.as_reader().read_to_string(&mut body)
        {
            eprintln!("Request reading error: {}", error);
            continue;
        }

        // Parse JSON
        let data: Value = match serde_json::from_str(&body) {
            Ok(value) => value,
            Err(_) => {
                send_json(
                    request,
                    json!({
                        "success": false,
                        "error": "Invalid JSON input"
                    }),
                    400,
                );
                continue;
            }
        };

        // Extract inputs
        let spot = data["spot"].as_f64();
        let strike = data["strike"].as_f64();
        let volatility = data["volatility"].as_f64();
        let rate = data["rate"].as_f64();
        let days = data["days"].as_f64();
        let steps = data["steps"].as_u64();

        let (spot, strike, volatility, rate, days, steps) =
            match (spot, strike, volatility, rate, days, steps) {
                (Some(s), Some(k), Some(v), Some(r), Some(d), Some(n))
                    if n > 0 && n <= 10000 =>
                {
                    (s, k, v, r, d, n as usize)
                }

                _ => {
                    send_json(
                        request,
                        json!({
                            "success": false,
                            "error": "Invalid inputs. Steps must be between 1 and 10000."
                        }),
                        400,
                    );
                    continue;
                }
            };

        // Convert days into years
        let time = days / 365.0;

        // Calculate theoretical call price
        let result = price_call_bopm(
            spot,
            strike,
            volatility,
            rate,
            0.0,
            time,
            steps,
        );

        match result {
            Ok(price) => {
                println!("BOPM price: Rs. {:.2}", price);

                send_json(
                    request,
                    json!({
                        "success": true,
                        "theoretical_price": price
                    }),
                    200,
                );
            }

            Err(error) => {
                send_json(
                    request,
                    json!({
                        "success": false,
                        "error": error
                    }),
                    400,
                );
            }
        }
    }
}

// ==========================================
// READ NSE MARKET DATA FROM CSV
// ==========================================

fn fetch_market_data_from_csv() -> Result<Value, String> {
    let mut reader = csv::Reader::from_path(CSV_FILE)
        .map_err(|error| {
            format!("Could not open NSE CSV file: {}", error)
        })?;

    let headers = reader.headers()
        .map_err(|error| format!("Could not read CSV headers: {}", error))?
        .clone();

    // Find required column positions
    let column = |name: &str| -> Result<usize, String> {
        headers.iter()
            .position(|header| header == name)
            .ok_or_else(|| format!("CSV column not found: {}", name))
    };

    let symbol_col = column("TckrSymb")?;
    let expiry_col = column("XpryDt")?;
    let strike_col = column("StrkPric")?;
    let option_col = column("OptnTp")?;
    let close_col = column("ClsPric")?;
    let last_col = column("LastPric")?;
    let spot_col = column("UndrlygPric")?;
    let volume_col = column("TtlTradgVol")?;
    let date_col = column("TradDt")?;

    // Find the required NIFTY call contract
    for record in reader.records() {
        let record = record.map_err(|error| {
            format!("Could not read CSV record: {}", error)
        })?;

        let symbol = record.get(symbol_col).unwrap_or("");
        let expiry = record.get(expiry_col).unwrap_or("");
        let strike_text = record.get(strike_col).unwrap_or("");
        let option_type = record.get(option_col).unwrap_or("");

        let strike: f64 = strike_text.parse().unwrap_or(-1.0);

        if symbol == "NIFTY"
            && expiry == "2026-11-17"
            && (strike - 25150.0).abs() < 0.01
            && option_type == "CE"
        {
            let closing_premium: f64 =
                record.get(close_col).unwrap_or("0")
                    .parse().unwrap_or(0.0);

            let last_price: f64 =
                record.get(last_col).unwrap_or("0")
                    .parse().unwrap_or(0.0);

            let spot: f64 =
                record.get(spot_col).unwrap_or("0")
                    .parse().unwrap_or(0.0);

            let volume: u64 =
                record.get(volume_col).unwrap_or("0")
                    .parse().unwrap_or(0);

            let trading_date =
                record.get(date_col).unwrap_or("");

            return Ok(json!({
                "success": true,
                "symbol": symbol,
                "trading_date": trading_date,
                "expiry": expiry,
                "strike": strike,
                "option_type": option_type,
                "closing_premium": closing_premium,
                "last_traded_price": last_price,
                "spot": spot,
                "volume": volume
            }));
        }
    }

    Err("NIFTY 25150 CE contract was not found in the CSV.".to_string())
}

// ==========================================
// SEND JSON RESPONSE
// ==========================================

fn send_json(
    request: tiny_http::Request,
    data: Value,
    status: u16,
) {
    let response = Response::from_string(data.to_string())
        .with_status_code(status)
        .with_header(Header::from_bytes(
            "Content-Type", "application/json"
        ).unwrap())
        .with_header(Header::from_bytes(
            "Access-Control-Allow-Origin", "*"
        ).unwrap());

    let _ = request.respond(response);
}

// ==========================================
// FETCH OPTION-CHAIN DATA FROM AFI CODES
// ==========================================

fn fetch_afi_options(
    date: &str,
    window: u32,
) -> Result<Value, String> {

    let api_key = env::var("AFI_API_KEY")
        .map_err(|_| {
            "AFI_API_KEY environment variable not found".to_string()
        })?;

    let url = format!(
        "https://api.afi.codes/v1/options/eod?symbol=NIFTY&date={}&window={}",
        date,
        window
    );

    let mut response = ureq::get(&url)
        .header("x-api-key", &api_key)
        .call()
        .map_err(|error| {
            format!("AFI API request failed: {}", error)
        })?;

    let body = response.body_mut()
        .read_to_string()
        .map_err(|error| {
            format!("Could not read AFI response: {}", error)
        })?;

    let data: Value = serde_json::from_str(&body)
        .map_err(|error| {
            format!("Invalid AFI JSON response: {}", error)
        })?;

    Ok(data)
}

// ==========================================
// BINOMIAL OPTION PRICING MODEL
// ==========================================

fn price_call_bopm(
    spot: f64,
    strike: f64,
    volatility: f64,
    rate: f64,
    dividend_yield: f64,
    time: f64,
    steps: usize,
) -> Result<f64, String> {

    // Validate numerical inputs
    if !spot.is_finite()
        || !strike.is_finite()
        || !volatility.is_finite()
        || !rate.is_finite()
        || !dividend_yield.is_finite()
        || !time.is_finite()
    {
        return Err("All inputs must be finite numbers.".to_string());
    }

    if spot <= 0.0 || strike <= 0.0 {
        return Err("Spot and strike must be positive.".to_string());
    }

    if volatility <= 0.0 || time <= 0.0 || steps == 0 {
        return Err(
            "Volatility, time and steps must be positive.".to_string()
        );
    }

    let dt = time / steps as f64;

    // Up and down factors
    let up = (volatility * dt.sqrt()).exp();
    let down = 1.0 / up;

    // Risk-neutral probability
    let growth = ((rate - dividend_yield) * dt).exp();

    let probability_up = (growth - down) / (up - down);
    let probability_down = 1.0 - probability_up;

    if !probability_up.is_finite()
        || !(0.0..=1.0).contains(&probability_up)
    {
        return Err(
            "Invalid risk-neutral probability. Check inputs.".to_string()
        );
    }

    let discount = (-rate * dt).exp();

    // Option values at expiry
    let mut option_values = vec![0.0; steps + 1];

    for j in 0..=steps {
        let final_stock_price =
            spot * up.powf(j as f64)
            * down.powf((steps - j) as f64);

        option_values[j] =
            (final_stock_price - strike).max(0.0);
    }

    // Backward induction
    for i in (0..steps).rev() {
        for j in 0..=i {
            option_values[j] = discount
                * (
                    probability_up * option_values[j + 1]
                    + probability_down * option_values[j]
                );
        }
    }

    Ok(option_values[0])
}
