"""
audit_dataset.py
================
Audits the handwriting dataset for mislabeled images.

Checks:
  1. PNG files whose filename encodes the wrong label (HandPD naming convention)
  2. Lists all unique numeric patient IDs per folder (for manual cross-reference)
  3. If you fill in KNOWN_HEALTHY_IDS / KNOWN_PD_IDS below, also confirms mismatches.

Run from:  ml-model/training/
    python audit_dataset.py
"""

import os
import re
from collections import defaultdict

DATASET_PATH = "handwriting_dataset"
HEALTHY_DIR  = os.path.join(DATASET_PATH, "healthy")
PD_DIR       = os.path.join(DATASET_PATH, "parkinsons")

# ---------------------------------------------------------------
# OPTIONAL: fill in patient IDs from your original dataset CSV.
# Leave empty to skip numeric-ID validation (you get a manifest).
# ---------------------------------------------------------------
# Patient IDs KNOWN to be Healthy in your numeric-ID (.jpg) dataset
KNOWN_HEALTHY_IDS: set = set()   # e.g. {"0068", "0100", "0102"}

# Patient IDs KNOWN to be Parkinson's in your numeric-ID (.jpg) dataset
KNOWN_PD_IDS: set = set()        # e.g. {"0002", "0003", "0009"}


# ---------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------

def get_files(folder):
    exts = {'.png', '.jpg', '.jpeg', '.bmp'}
    return [f for f in os.listdir(folder)
            if os.path.splitext(f)[1].lower() in exts]


def classify_png_filename(filename):
    """
    HandPD naming convention:
        V##HE##.png  /  V##HO##.png  -> Healthy
        V##PE##.png  /  V##PO##.png  -> Parkinson's
    Returns 'healthy', 'pd', or 'unknown'.
    """
    name = os.path.splitext(filename)[0].upper()
    m = re.match(r'^V\d+([HP])[EO]\d*$', name)
    if m:
        return 'healthy' if m.group(1) == 'H' else 'pd'
    return 'unknown'


def extract_numeric_patient_id(filename):
    """For files like 0068-1.jpg, returns '0068'. Else None."""
    m = re.match(r'^(\d{4})-\d+', filename)
    return m.group(1) if m else None


def audit_folder(folder_path, expected_label):
    files = get_files(folder_path)

    png_wrong   = []
    png_correct = 0
    png_unknown = []
    numeric_ids_found    = defaultdict(list)
    numeric_mislabeled   = []

    for f in files:
        ext = os.path.splitext(f)[1].lower()

        if ext == '.png':
            detected = classify_png_filename(f)
            if detected == 'unknown':
                png_unknown.append(f)
            elif detected == expected_label:
                png_correct += 1
            else:
                png_wrong.append(f)

        elif ext in {'.jpg', '.jpeg', '.bmp'}:
            pid = extract_numeric_patient_id(f)
            if pid:
                numeric_ids_found[pid].append(f)

    # Cross-check numeric IDs if known sets are populated
    if KNOWN_HEALTHY_IDS or KNOWN_PD_IDS:
        for pid, flist in numeric_ids_found.items():
            if expected_label == 'healthy' and pid in KNOWN_PD_IDS:
                numeric_mislabeled.extend(flist)
            elif expected_label == 'pd' and pid in KNOWN_HEALTHY_IDS:
                numeric_mislabeled.extend(flist)

    return {
        'total'             : len(files),
        'png_correct'       : png_correct,
        'png_wrong'         : png_wrong,
        'png_unknown'       : png_unknown,
        'numeric_ids'       : dict(numeric_ids_found),
        'numeric_mislabeled': numeric_mislabeled,
    }


# ---------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------

def main():
    SEP  = "=" * 65
    SEP2 = "-" * 65

    print(SEP)
    print("  NeuroSense-AI -- Dataset Audit Report")
    print(SEP)

    for folder, label in [(HEALTHY_DIR, 'healthy'), (PD_DIR, 'pd')]:
        print()
        print(SEP2)
        print(f"  Folder         : {folder}")
        print(f"  Expected label : {label.upper()}")
        print(SEP2)

        result = audit_folder(folder, label)
        print(f"  Total images        : {result['total']}")
        print(f"  PNG correct label   : {result['png_correct']}")

        # PNG mislabeled ----------------------------------------
        if result['png_wrong']:
            print()
            print(f"  [!!!] PNG FILES WITH WRONG LABEL IN FILENAME ({len(result['png_wrong'])}):")
            for f in result['png_wrong']:
                print(f"        MISLABELED: {f}")
        else:
            print(f"  PNG label check     : OK - none mislabeled by filename")

        # PNG unknown naming ------------------------------------
        if result['png_unknown']:
            print()
            print(f"  [?] PNG FILES WITH UNRECOGNISED NAMING ({len(result['png_unknown'])}):")
            for f in result['png_unknown'][:20]:
                print(f"        UNKNOWN: {f}")
            if len(result['png_unknown']) > 20:
                print(f"        ... and {len(result['png_unknown']) - 20} more")

        # Numeric patient IDs -----------------------------------
        ids = sorted(result['numeric_ids'].keys())
        print()
        print(f"  NUMERIC PATIENT IDs found ({len(ids)}):")
        if ids:
            for pid in ids:
                count = len(result['numeric_ids'][pid])
                flag  = ""
                if KNOWN_PD_IDS and label == 'healthy' and pid in KNOWN_PD_IDS:
                    flag = "  <-- KNOWN PD PATIENT - MISLABELED!"
                elif KNOWN_HEALTHY_IDS and label == 'pd' and pid in KNOWN_HEALTHY_IDS:
                    flag = "  <-- KNOWN HEALTHY PATIENT - MISLABELED!"
                print(f"        ID {pid}  ({count} images){flag}")
        else:
            print("        (none)")

        # Confirmed mislabeled ----------------------------------
        if result['numeric_mislabeled']:
            print()
            print(f"  [!!!] CONFIRMED MISLABELED FILES ({len(result['numeric_mislabeled'])}):")
            for f in result['numeric_mislabeled'][:30]:
                print(f"        REMOVE/MOVE: {f}")
        elif KNOWN_HEALTHY_IDS or KNOWN_PD_IDS:
            print()
            print("  Numeric ID check    : OK - no confirmed mislabeled files")
        else:
            print()
            print("  Numeric ID check    : SKIPPED")
            print("                        Fill KNOWN_HEALTHY_IDS / KNOWN_PD_IDS")
            print("                        at the top of this script, then re-run.")

    # Summary ---------------------------------------------------
    print()
    print(SEP)
    print("  NEXT STEPS:")
    print()
    print("  1. Any 'MISLABELED' PNG files above must be moved to the")
    print("     correct folder before retraining.")
    print()
    print("  2. For numeric (.jpg) IDs — check against your original")
    print("     dataset metadata/CSV to confirm which IDs are healthy vs PD.")
    print("     Then fill in KNOWN_HEALTHY_IDS / KNOWN_PD_IDS and re-run.")
    print()
    print("  3. Also delete .DS_Store files (macOS junk, harmless but messy).")
    print("     Run:  del /s /q handwriting_dataset\\.DS_Store")
    print(SEP)


if __name__ == "__main__":
    main()
