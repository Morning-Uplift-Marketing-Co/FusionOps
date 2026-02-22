
import sys
import io
import os

# Force utf-8 encoding for stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Ensure we can import from local modules
sys.path.append(os.getcwd())

try:
    from design_system import generate_design_system
    
    result = generate_design_system(
        "installment loans finance trustworthy",
        "Installment Loans",
        "markdown"
    )
    print(result)
except Exception as e:
    print(f"Error: {e}")
