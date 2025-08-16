import pandas as pd
import json
import os

# File paths
data_dir = "data"
output_dir = "docs/js"
financial_summary_file = os.path.join(data_dir, "financial_summary.csv")
member_contributions_file = os.path.join(data_dir, "member_contributions.csv")
output_file = os.path.join(output_dir, "data.json")

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

# Read financial summary
financial_summary = pd.read_csv(financial_summary_file)
inflows = int(financial_summary["Total Monthly Income"].sum())  # Convert to int
outflows = int(financial_summary["Total"].sum())  # Convert to int
total_balance = int(inflows - outflows)  # Convert to int

# Read member contributions
member_contributions = pd.read_csv(member_contributions_file).to_dict(orient="records")

# Prepare data for JSON
data = {
    "total_balance": total_balance,
    "inflows": inflows,
    "outflows": outflows,
    "member_contributions": member_contributions
}

# Write to data.json
with open(output_file, "w") as f:
    json.dump(data, f, indent=2)

print(f"Data processed and saved to {output_file}")