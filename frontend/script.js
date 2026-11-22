
const form = document.getElementById("floodForm");

form.addEventListener("submit", async function(event) {

    event.preventDefault();

    const selectedDistrict = document.getElementById("district").value;

    const condition = document.getElementById(
        "embankment_condition"
    ).value;

    const data = {
        district: selectedDistrict,
        rainfall_24h_mm: Number(document.getElementById("rainfall_24h_mm").value),
        rainfall_7day_mm: Number(document.getElementById("rainfall_7day_mm").value),
        river_water_level_m: Number(document.getElementById("river_water_level_m").value),
        river_level_change_24h_m: Number(document.getElementById("river_level_change_24h_m").value),
        river_discharge_cumecs: Number(document.getElementById("river_discharge_cumecs").value),
        soil_moisture_percent: Number(document.getElementById("soil_moisture_percent").value),
        elevation_m: Number(document.getElementById("elevation_m").value),
        distance_to_river_km: Number(document.getElementById("distance_to_river_km").value),
        drainage_capacity_index: Number(document.getElementById("drainage_capacity_index").value),

        embankment_condition_Good: condition === "Good" ? 1 : 0,
        embankment_condition_Moderate: condition === "Moderate" ? 1 : 0,
        embankment_condition_Poor: condition === "Poor" ? 1 : 0
    };

    const resultDiv = document.getElementById("result");
    resultDiv.textContent = "Checking flood risk...";

    try {
        const response = await fetch("http://127.0.0.1:8000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error("API request failed: " + response.status);
        }

        const result = await response.json();

        const floodProbability = result.flood_probability;
        const noFloodProbability = result.no_flood_probability;

        const isFlood = result.prediction === "Flood";

        resultDiv.innerHTML = `
            <div class="prediction-card">

                <h2>Flood Prediction Result</h2>

                <h3 class="${isFlood ? 'flood-status' : 'safe-status'}">
                    ${isFlood ? '⚠️ Flood Risk Detected' : '✅ No Flood Predicted'}
                </h3>

                <p><strong>State:</strong> Punjab</p>
                <p><strong>District:</strong> ${selectedDistrict}</p>

                <div class="probability-section">

                    <p>Flood Probability: ${floodProbability}%</p>

                    <div class="progress-bar">
                        <div class="flood-progress"
                             style="width: ${floodProbability}%">
                        </div>
                    </div>

                    <p>No Flood Probability: ${noFloodProbability}%</p>

                    <div class="progress-bar">
                        <div class="safe-progress"
                             style="width: ${noFloodProbability}%">
                        </div>
                    </div>

                </div>

                <small>
                    This is an ML model estimate, not an official flood warning.
                </small>

            </div>
        `;

    } catch (error) {
        resultDiv.textContent = "Error connecting to prediction server.";
        console.error(error);
    }

});


async function showHistory() {

    document.getElementById("floodForm").style.display = "none";
    document.getElementById("result").style.display = "none";

    const historySection = document.getElementById("historySection");
    historySection.style.display = "block";

    const historySummary = document.getElementById("historySummary");
    const historyTable = document.getElementById("historyTable");

    historySummary.textContent = "Loading history...";
    historyTable.innerHTML = "";

    try {

        const response = await fetch("http://127.0.0.1:8000/history");

        if (!response.ok) {
            throw new Error("Unable to fetch history");
        }

        const data = await response.json();

        const records = data.history;

        const floodCount = records.filter(
            item => item.prediction === "Flood"
        ).length;

        const noFloodCount = records.filter(
            item => item.prediction === "No Flood"
        ).length;

        historySummary.innerHTML = `
            <p><strong>Total Records:</strong> ${data.total_records}</p>
            <p><strong>Flood Predictions:</strong> ${floodCount}</p>
            <p><strong>No Flood Predictions:</strong> ${noFloodCount}</p>
        `;

        if (records.length === 0) {
            historyTable.textContent = "No prediction history available.";
            return;
        }

        historyTable.innerHTML = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>District</th>
                        <th>Prediction</th>
                        <th>Flood Probability</th>
                        <th>No Flood Probability</th>
                        <th>Date</th>
                    </tr>
                </thead>

                <tbody>
                    ${records.map(item => `
                        <tr>
                            <td>${item.id}</td>
                            <td>${escapeHTML(item.district)}</td>
                            <td>${escapeHTML(item.prediction)}</td>
                            <td>${item.flood_probability}%</td>
                            <td>${item.no_flood_probability}%</td>
                            <td>${escapeHTML(item.created_at)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

    } catch (error) {
        historySummary.textContent = "Error loading prediction history.";
        console.error(error);
    }
}

function showPrediction() {

    document.getElementById("historySection").style.display = "none";
    document.getElementById("floodForm").style.display = "block";
    document.getElementById("result").style.display = "block";
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

document.getElementById("floodForm").addEventListener("reset", function () {
    document.getElementById("result").innerHTML = "";
});