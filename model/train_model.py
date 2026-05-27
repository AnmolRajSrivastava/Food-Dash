import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import pickle
import os
import math

print("1. Loading local dataset...")
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'train.csv')

try:
    df = pd.read_csv(data_path)
    print(f"Dataset loaded successfully! Shape: {df.shape}")
except Exception as e:
    print(f"Error loading dataset: {e}")
    print("Please make sure 'train.csv' is inside the 'data' folder.")
    exit(1)

print("2. Cleaning and processing data...")

# --- FEATURE ENGINEERING: The Haversine Formula ---
# The ML model doesn't understand raw GPS coordinates (Lat/Lng).
# We use this mathematical formula to calculate the exact shortest distance
# across the curved surface of the Earth to get 'Distance in KM'.
def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# Calculate distance
df['Distance_km'] = df.apply(lambda row: haversine(
    row['Restaurant_latitude'], row['Restaurant_longitude'],
    row['Delivery_location_latitude'], row['Delivery_location_longitude']
), axis=1)

# Clean strings (dataset has trailing spaces and 'conditions ' prefixes)
df['Weatherconditions'] = df['Weatherconditions'].astype(str).str.replace('conditions ', '', regex=False).str.strip()
df['Road_traffic_density'] = df['Road_traffic_density'].astype(str).str.strip()

# Handle NaNs
df.dropna(subset=['Weatherconditions', 'Road_traffic_density', 'Distance_km', 'Time_taken(min)'], inplace=True)
if df['Time_taken(min)'].dtype == object:
    df['Time_taken(min)'] = df['Time_taken(min)'].str.extract(r'(\d+)').astype(float)

# Select features
features = ['Weatherconditions', 'Road_traffic_density', 'Distance_km']
X = df[features].copy()
y = df['Time_taken(min)']

# Encode categorical variables
print("3. Encoding features...")
encoders = {}
for col in ['Weatherconditions', 'Road_traffic_density']:
    le = LabelEncoder()
    # Fill unknown with a default to avoid fitting errors
    X[col] = X[col].fillna('Unknown')
    X[col] = le.fit_transform(X[col])
    encoders[col] = le

# Train model
print("4. Training Random Forest Model...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(f"Model trained! MAE: {mean_absolute_error(y_test, y_pred):.2f} mins, R2: {r2_score(y_test, y_pred):.2f}")

# Save artifacts
print("5. Saving model and encoders...")
model_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(model_dir, 'model.pkl'), 'wb') as f:
    pickle.dump(model, f)
with open(os.path.join(model_dir, 'preprocessor.pkl'), 'wb') as f:
    pickle.dump(encoders, f)

print("Done! Model is ready.")
