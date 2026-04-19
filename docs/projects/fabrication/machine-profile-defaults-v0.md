# Preflight — Machine Profile Defaults v0

> **Status:** DRAFT for Matt review. Every field marked `VERIFY` needs manufacturer-sheet confirmation before Phase 1 seed insert.
> **Spec source:** `docs/projects/fabrication-pipeline.md` §7 (Machine Profiles)
> **Purpose:** Seed data for Phase 1 migration — 12 machines teachers can clone in one click when setting up their lab.
> **Author:** Code (draft) · **Verifier:** Matt (Phase 0 sub-task 0.3)

## How to verify

For each machine:

1. Open the manufacturer spec page (linked in `source_url`).
2. Confirm the 3–5 key fields marked `VERIFY` — especially bed dimensions (mm NOT inches), nozzle diameter, and max material thickness.
3. Strike through or replace any value that's wrong, add `source: <url>` citation.
4. If a machine has been discontinued or specs are unavailable, **drop it** — v1 ships 10–12, not necessarily 12.

Known-uncertain fields are marked. Spec sheets in 2026 may differ from older units in schools — favour the older (more common) unit spec where ambiguous.

---

## 3D Printers (6)

### 1. Bambu Lab X1 Carbon (X1C)

```yaml
name: "Bambu Lab X1 Carbon"
machine_category: 3d_printer
machine_model: "X1 Carbon"
bed_size_x_mm: 256    # VERIFY
bed_size_y_mm: 256    # VERIFY
bed_size_z_mm: 256    # VERIFY
nozzle_diameter_mm: 0.4    # default; 0.2/0.6/0.8 available
supported_materials: ["PLA", "PETG", "ABS", "ASA", "TPU", "PA", "PC"]
max_print_time_min: 1440    # 24h — teacher-tunable
supports_auto_supports: true
source_url: "https://bambulab.com/en/x1"
notes: "Default Bambu school choice post-2024. Chamber + hardened nozzle → broader materials than Prusa."
```

### 2. Bambu Lab P1S (also covers P1P)

```yaml
name: "Bambu Lab P1S"
machine_category: 3d_printer
machine_model: "P1S"
bed_size_x_mm: 256    # VERIFY — same frame as X1C
bed_size_y_mm: 256
bed_size_z_mm: 256
nozzle_diameter_mm: 0.4
supported_materials: ["PLA", "PETG", "ABS", "ASA", "TPU"]
max_print_time_min: 1440
supports_auto_supports: true
source_url: "https://bambulab.com/en/p1"
notes: "Budget Bambu — similar volume to X1C, no built-in AI camera. Very common in UK/AU schools."
```

### 3. Prusa MK4S (also covers MK4)

```yaml
name: "Prusa MK4S"
machine_category: 3d_printer
machine_model: "MK4S"
bed_size_x_mm: 250    # VERIFY
bed_size_y_mm: 210    # VERIFY
bed_size_z_mm: 220    # VERIFY
nozzle_diameter_mm: 0.4
supported_materials: ["PLA", "PETG", "ASA", "PC", "PA"]
max_print_time_min: 1440
supports_auto_supports: true
source_url: "https://www.prusa3d.com/product/original-prusa-mk4s-2/"
notes: "Prusa MK3S+ still widespread in older school labs — same bed footprint, add as separate profile if needed."
```

### 4. Creality Ender 3 V2 (also covers S1, Neo variants)

```yaml
name: "Creality Ender 3 V2"
machine_category: 3d_printer
machine_model: "Ender 3 V2"
bed_size_x_mm: 220    # VERIFY
bed_size_y_mm: 220    # VERIFY
bed_size_z_mm: 250    # VERIFY
nozzle_diameter_mm: 0.4
supported_materials: ["PLA", "PETG", "TPU"]    # ABS possible but risky on open frame
max_print_time_min: 720
supports_auto_supports: false    # user-sliced supports only on stock firmware
source_url: "https://www.creality.com/products/ender-3-v2-3d-printer-csco"
notes: "Budget classroom workhorse. Many variants — S1/S1 Pro bed is same footprint."
```

### 5. Ultimaker S3

```yaml
name: "Ultimaker S3"
machine_category: 3d_printer
machine_model: "S3"
bed_size_x_mm: 230    # VERIFY
bed_size_y_mm: 190    # VERIFY
bed_size_z_mm: 200    # VERIFY
nozzle_diameter_mm: 0.4    # AA 0.4 default; 0.25/0.8 available
supported_materials: ["PLA", "PETG", "ABS", "CPE", "TPU", "PC", "Nylon"]
max_print_time_min: 1440
supports_auto_supports: true
source_url: "https://ultimaker.com/3d-printers/s3/"
notes: "Ultimaker S5 bed is larger (330×240×300) — add as separate profile if pilot school has one."
```

### 6. Makerbot Replicator+

```yaml
name: "Makerbot Replicator+"
machine_category: 3d_printer
machine_model: "Replicator+"
bed_size_x_mm: 295    # VERIFY
bed_size_y_mm: 195    # VERIFY
bed_size_z_mm: 165    # VERIFY
nozzle_diameter_mm: 0.4    # Smart Extruder+
supported_materials: ["PLA"]    # Makerbot PLA-focused; tough PLA for mechanical use
max_print_time_min: 720
supports_auto_supports: true
source_url: "https://www.makerbot.com/3d-printers/replicator/"
notes: "Older/legacy in many US schools. Consider dropping from v1 seed if no pilot school uses it — Method X is the newer line but rarer."
```

---

## Laser Cutters (6)

### 7. Glowforge Pro

```yaml
name: "Glowforge Pro"
machine_category: laser_cutter
machine_model: "Pro"
bed_size_x_mm: 495    # VERIFY
bed_size_y_mm: 279    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.2    # typical for 40W CO2 on 3mm ply — material-dependent
min_feature_mm: 0.3
operation_color_map:
  # Glowforge uses ANY stroke colour for cuts; the Glowforge app differentiates by layer.
  # These are COMMON conventions teachers use — not Glowforge-enforced.
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://glowforge.com/pro"
notes: "Glowforge's actual mapping is done inside their app per-layer — these defaults match the 'teach students one colour convention' pattern most DT labs adopt."
```

### 8. Glowforge Plus

```yaml
name: "Glowforge Plus"
machine_category: laser_cutter
machine_model: "Plus"
bed_size_x_mm: 495    # VERIFY — same frame as Pro
bed_size_y_mm: 279    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.2
min_feature_mm: 0.3
operation_color_map:
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://glowforge.com/plus"
notes: "No pass-through slot (vs Pro) — bed-size limit is hard. Everything else identical for scanning purposes."
```

### 9. xTool M1

```yaml
name: "xTool M1"
machine_category: laser_cutter
machine_model: "M1"
bed_size_x_mm: 385    # VERIFY
bed_size_y_mm: 300    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.15    # 10W diode — tighter kerf than CO2 on thin materials
min_feature_mm: 0.2
operation_color_map:
  # xTool Creative Space uses layer colours — these are conventions, not enforced
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://www.xtool.com/products/xtool-m1"
notes: "Hybrid laser + blade cutter — blade operations out of scope for v1. Diode wavelength means some materials (clear acrylic) don't cut well."
```

### 10. xTool P2

```yaml
name: "xTool P2"
machine_category: laser_cutter
machine_model: "P2"
bed_size_x_mm: 600    # VERIFY
bed_size_y_mm: 308    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.2    # 55W CO2
min_feature_mm: 0.3
operation_color_map:
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://www.xtool.com/products/xtool-p2-co2-laser-cutter"
notes: "Larger bed than Glowforge. CO2 means cleaner cuts on acrylic. Rising popularity in DT labs 2025+."
```

### 11. xTool S1

```yaml
name: "xTool S1"
machine_category: laser_cutter
machine_model: "S1"
bed_size_x_mm: 498    # VERIFY
bed_size_y_mm: 319    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.15    # 20W/40W diode options
min_feature_mm: 0.2
operation_color_map:
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://www.xtool.com/products/xtool-s1"
notes: "Enclosed diode — safer for classrooms than open-frame. 40W variant handles thicker materials."
```

### 12. Gweike Cloud Pro

```yaml
name: "Gweike Cloud Pro"
machine_category: laser_cutter
machine_model: "Cloud Pro"
bed_size_x_mm: 500    # VERIFY
bed_size_y_mm: 300    # VERIFY
bed_size_z_mm: null
kerf_mm: 0.2
min_feature_mm: 0.3
operation_color_map:
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
source_url: "https://gweikecloud.com/products/gweike-cloud-pro-50w-desktop-co2-laser-engraver-cutter"
notes: "50W CO2 — budget alternative to Glowforge/xTool P2. Popular in UK/EU school budgets."
```

---

## Fallback / generic profiles

For machines outside the seeded 12, teachers use the custom-profile builder (Phase 1 feature) starting from one of two generic templates:

### Generic 3D Printer (unknown model)

```yaml
name: "Generic 3D Printer"
machine_category: 3d_printer
machine_model: "Custom"
bed_size_x_mm: 200    # conservative default
bed_size_y_mm: 200
bed_size_z_mm: 200
nozzle_diameter_mm: 0.4
supported_materials: ["PLA"]
max_print_time_min: 720
supports_auto_supports: false
notes: "Starting template. Teacher should override bed dimensions from their machine's spec sheet."
```

### Generic Laser Cutter (unknown model)

```yaml
name: "Generic Laser Cutter"
machine_category: laser_cutter
machine_model: "Custom"
bed_size_x_mm: 400
bed_size_y_mm: 300
bed_size_z_mm: null
kerf_mm: 0.2
min_feature_mm: 0.3
operation_color_map:
  "#FF0000": "cut"
  "#0000FF": "score"
  "#000000": "engrave"
notes: "Starting template. Teacher should verify bed dimensions and the manufacturer's stroke-colour convention."
```

---

## Open questions for Matt

1. **Drop candidates?** Replicator+ is old — worth dropping from v1 seed if no pilot school uses one. Saves a migration row and reduces maintenance.
2. **Bambu A1 mini / A1?** Added to the Bambu lineup in 2024. Big in hobby but less in schools — defer to v1.1 unless NIS has one.
3. **Laser colour map confidence.** Glowforge doesn't strictly enforce stroke-colour conventions; xTool's software uses layers. The red/blue/black defaults are what most DT teachers TEACH — not what the machines mandate. OK to ship these defaults with a "teacher can override" UI note?
4. **Metric vs imperial.** All bed dimensions above are mm. US schools may have machines with imperial spec sheets (Epilog Zing 16 = 16×12 inches = 406×305 mm). Do all seed profiles auto-convert to mm, or do we store both? Recommend mm only — convert at import time.
5. **CNC / vinyl / embroidery deliberately omitted per spec §3.** Confirm that holds — no pressure from NIS to include?
