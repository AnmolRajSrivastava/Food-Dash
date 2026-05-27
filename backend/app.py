from flask import Flask, request, jsonify
from flask_cors import CORS
from predictor import DeliveryPredictor

app = Flask(__name__)
CORS(app)

predictor = DeliveryPredictor()

@app.route('/predict', methods=['POST'])
def predict():
    if not predictor.is_ready:
        return jsonify({'error': 'Model not trained or loaded.'}), 500
        
    try:
        data = request.json
        print(f"--- DEBUG PAYLOAD RECEIVED: {data} ---")
        weather = data.get('weather', 'Sunny')
        traffic = data.get('traffic', 'Low')
        distance = float(data.get('distance', 5.0))
        
        result = predictor.predict(weather, traffic, distance)
        result['status'] = 'success'
        return jsonify(result)
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
