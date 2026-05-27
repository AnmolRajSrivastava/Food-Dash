import pickle
import pandas as pd
import os

class DeliveryPredictor:
    def __init__(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, '..', 'model', 'model.pkl')
        encoders_path = os.path.join(base_dir, '..', 'model', 'preprocessor.pkl')
        
        try:
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            with open(encoders_path, 'rb') as f:
                self.encoders = pickle.load(f)
            self.is_ready = True
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
            self.encoders = None
            self.is_ready = False

    def predict(self, weather, traffic, distance):
        if not self.is_ready:
            raise Exception("Model not loaded properly.")
            
        # --- HYBRID ML/PHYSICS PREDICTION ---
        # Random Forests cannot extrapolate beyond their training data (usually max 20km).
        # If we ask for 80km, it just outputs its highest known value (e.g. 45 mins).
        # SOLUTION: We query the ML model at a standard "safe" distance (10km) to learn 
        # the exact complex penalties for weather/traffic, then scale it mathematically!
        
        input_data = pd.DataFrame({
            'Weatherconditions': [weather],
            'Road_traffic_density': [traffic],
            'Distance_km': [10.0] # Query at 10km
        })
        
        for col in ['Weatherconditions', 'Road_traffic_density']:
            le = self.encoders.get(col)
            if le:
                try:
                    input_data[col] = le.transform(input_data[col])
                except ValueError:
                    input_data[col] = 0
                    
        # ML Prediction for 10km under chosen conditions
        pred_time_10km = self.model.predict(input_data)[0]
        
        # ML Prediction for 10km under perfect conditions
        baseline = pd.DataFrame({
            'Weatherconditions': [self.encoders['Weatherconditions'].transform(['Sunny'] if 'Sunny' in self.encoders['Weatherconditions'].classes_ else [self.encoders['Weatherconditions'].classes_[0]])[0]],
            'Road_traffic_density': [self.encoders['Road_traffic_density'].transform(['Low'] if 'Low' in self.encoders['Road_traffic_density'].classes_ else [self.encoders['Road_traffic_density'].classes_[0]])[0]],
            'Distance_km': [10.0]
        })
        base_time_10km = self.model.predict(baseline)[0]
        
        # Calculate real mathematical base time: 10 min prep + 2 mins per km
        real_base_time = 10.0 + (distance * 2.0)
        
        # Find the penalty multiplier the ML model learned
        penalty_multiplier = pred_time_10km / base_time_10km if base_time_10km > 0 else 1.0
        
        # Dataset Noise Fix: Sometimes real-world data noise makes 'Sunny' slower than 'Stormy'.
        # We enforce a minimum multiplier of 1.0 so we never get negative penalties.
        penalty_multiplier = max(1.0, penalty_multiplier)
        
        # Apply the ML multiplier to the real mathematical time
        pred_time = real_base_time * penalty_multiplier
        
        # Break down the penalties
        total_penalty = pred_time - real_base_time
        weather_penalty = total_penalty * 0.4
        traffic_penalty = total_penalty * 0.6
        
        return {
            'predicted_time': round(pred_time),
            'base_time': round(real_base_time),
            'weather_penalty': round(weather_penalty),
            'traffic_penalty': round(traffic_penalty)
        }
