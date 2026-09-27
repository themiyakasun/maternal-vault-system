"""
MaternaVault CLI Prediction Tool
Reads patient JSON from stdin or argument and outputs ML inference JSON to stdout.
"""

import sys
import os
import json
import warnings

warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)

# Ensure predict_service module can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from predict_service import load_models, evaluate_all_models

def main():
    load_models()
    
    if len(sys.argv) > 1:
        raw_input = sys.argv[1]
    else:
        raw_input = sys.stdin.read()

    try:
        data = json.loads(raw_input)
        assessment = evaluate_all_models(data)
        print(json.dumps({'success': True, 'data': assessment}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
