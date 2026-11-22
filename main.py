from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from database import get_db_connection

from fastapi import FastAPI
from pydantic import BaseModel

# Initialize FastAPI
app = FastAPI(title="Punjab Flood Prediction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load existing trained model
model = joblib.load("flood_model.pkl")


# Define user input features
class FloodInput(BaseModel):
    district: str
    rainfall_24h_mm: float
    rainfall_7day_mm: float
    river_water_level_m: float
    river_level_change_24h_m: float
    river_discharge_cumecs: float
    soil_moisture_percent: float
    elevation_m: float
    distance_to_river_km: float
    drainage_capacity_index: float
    embankment_condition_Good: int
    embankment_condition_Moderate: int
    embankment_condition_Poor: int


# Home route
@app.get("/")
def home():
    return {"message": "Punjab Flood Prediction API is running!"}


# Prediction route

@app.post("/predict")
def predict_flood(data: FloodInput):

    # Step 1: Prepare input for ML model
    input_data = pd.DataFrame([
        data.model_dump(exclude={"district"})
    ])

    # Step 2: Generate prediction
    prediction = model.predict(input_data)
    probability = model.predict_proba(input_data)

    result = "Flood" if prediction[0] == 1 else "No Flood"

    flood_probability = round(float(probability[0][1]) * 100, 2)
    no_flood_probability = round(float(probability[0][0]) * 100, 2)

    # Step 3: Identify embankment condition
    if data.embankment_condition_Good == 1:
        condition = "Good"
    elif data.embankment_condition_Moderate == 1:
        condition = "Moderate"
    else:
        condition = "Poor"

    # Step 4: Save prediction in MySQL
    connection = None
    cursor = None
    saved_to_database = False

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
        INSERT INTO prediction_history (
            state,
            district,
            rainfall_24h_mm,
            rainfall_7day_mm,
            river_water_level_m,
            river_level_change_24h_m,
            river_discharge_cumecs,
            soil_moisture_percent,
            elevation_m,
            distance_to_river_km,
            drainage_capacity_index,
            embankment_condition,
            prediction,
            flood_probability,
            no_flood_probability
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            "Punjab",
            data.district,
            data.rainfall_24h_mm,
            data.rainfall_7day_mm,
            data.river_water_level_m,
            data.river_level_change_24h_m,
            data.river_discharge_cumecs,
            data.soil_moisture_percent,
            data.elevation_m,
            data.distance_to_river_km,
            data.drainage_capacity_index,
            condition,
            result,
            flood_probability,
            no_flood_probability
        )

        cursor.execute(query, values)
        connection.commit()

        saved_to_database = True
        print("Prediction saved successfully in MySQL!")

    except Exception as error:
        print("Database Error:", error)

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()

    # Step 5: Return prediction to frontend
    return {
        "prediction": result,
        "no_flood_probability": no_flood_probability,
        "flood_probability": flood_probability,
        "saved_to_database": saved_to_database
    }


@app.get("/history")
def get_prediction_history():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
        SELECT *
        FROM prediction_history
        ORDER BY created_at DESC
        LIMIT 100
        """

        cursor.execute(query)

        history = cursor.fetchall()

        # Convert timestamps into readable strings
        for record in history:
            if record["created_at"]:
                record["created_at"] = record["created_at"].isoformat()

        return {
            "total_records": len(history),
            "history": history
        }

    except Exception as error:
        print("History Error:", error)
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch prediction history"
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()
