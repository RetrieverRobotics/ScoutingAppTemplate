import os
import sys

def imports_for_testing():
    """Add the repository root to the import path for testing purposes."""
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))