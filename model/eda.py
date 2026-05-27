import pandas as pd
# pyrefly: ignore [missing-import]
import matplotlib.pyplot as plt
import os

# Load dataset
data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'food_delivery.csv')

try:
    df = pd.read_csv(data_path)
    print("Dataset Overview:")
    print("-----------------")
    print(df.head())
    
    print("\nDataset Info:")
    print("-------------")
    print(df.info())
    
    print("\nSummary Statistics:")
    print("-------------------")
    print(df.describe())
    
    print("\nNull Values:")
    print("------------")
    print(df.isnull().sum())
    
    # Save a basic plot
    plt.figure(figsize=(10, 6))
    if 'Time_taken(min)' in df.columns:
        # Clean target if it's a string
        if df['Time_taken(min)'].dtype == object:
            df['Time_taken(min)'] = df['Time_taken(min)'].str.extract(r'(\d+)').astype(float)
            
        plt.hist(df['Time_taken(min)'].dropna(), bins=30, color='skyblue', edgecolor='black')
        plt.title('Distribution of Delivery Times')
        plt.xlabel('Time Taken (mins)')
        plt.ylabel('Frequency')
        plot_path = os.path.join(os.path.dirname(__file__), 'delivery_time_dist.png')
        plt.savefig(plot_path)
        print(f"\nSaved distribution plot to {plot_path}")
        
except FileNotFoundError:
    print(f"Dataset not found at {data_path}. Please run train_model.py first.")
