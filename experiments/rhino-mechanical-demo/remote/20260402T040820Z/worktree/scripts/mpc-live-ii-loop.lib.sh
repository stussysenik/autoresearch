#!/usr/bin/env bash

mpc_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  cd "$script_dir/.." && pwd -P
}

mpc_work_root() {
  printf '%s\n' "$(mpc_repo_root)/var/mpc-live-ii"
}

mpc_source_dir() {
  printf '%s\n' "$(mpc_work_root)/source-pack"
}

mpc_research_dir() {
  printf '%s\n' "$(mpc_work_root)/research"
}

mpc_manual_url() {
  printf '%s\n' 'https://cdn.inmusicbrands.com/akai/M2P11C6VI/MPC%20X%2C%20MPC%20Live%2C%20MPC%20Live%20II%2C%20MPC%20One%2C%20MPC%20Key%2061%2C%20MPC%20Studio%20mk2%2C%20MPC%20Touch%20-%20User%20Guide%20-%20v2.11.6.pdf'
}

mpc_product_url() {
  printf '%s\n' 'https://www.akaipro.com/mpc-live-2/'
}

mpc_product_page_data_url() {
  printf '%s\n' 'https://www.akaipro.com/page-data/mpc-live-2/page-data.json'
}

mpc_expected_dimensions_mm() {
  printf '%s\n' '411.5 x 243.8 x 45.7 mm'
}

mpc_expected_weight_kg() {
  printf '%s\n' '3.38'
}

mpc_expected_pads() {
  printf '%s\n' '16'
}

mpc_expected_qlink_knobs() {
  printf '%s\n' '4'
}

mpc_expected_qlink_columns() {
  printf '%s\n' '4'
}

mpc_require_tools() {
  local missing=0
  local tool
  for tool in curl jq pdftotext rg; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      printf 'missing required tool: %s\n' "$tool" >&2
      missing=1
    fi
  done
  return "$missing"
}

mpc_refresh_source_pack() {
  local source_dir manual_pdf product_html product_json
  source_dir="$(mpc_source_dir)"
  manual_pdf="$source_dir/akai-mpc-live-ii-user-guide-v2.11.6.pdf"
  product_html="$source_dir/akai-mpc-live-ii.html"
  product_json="$source_dir/akai-mpc-live-ii-page-data.json"

  mkdir -p "$source_dir"

  curl --fail --location --silent --show-error "$(mpc_manual_url)" -o "$manual_pdf"
  curl --fail --location --silent --show-error "$(mpc_product_url)" -o "$product_html"
  curl --fail --location --silent --show-error "$(mpc_product_page_data_url)" -o "$product_json"

  printf '%s\n' "$source_dir"
}

mpc_extract_research_json() {
  local source_dir manual_pdf product_json page_text manual_text control_map_text
  local dimensions_line weight_line pads_line qlink_knobs_line qlink_columns_line
  local screenshot_url

  source_dir="${1:-$(mpc_source_dir)}"
  manual_pdf="$source_dir/akai-mpc-live-ii-user-guide-v2.11.6.pdf"
  product_json="$source_dir/akai-mpc-live-ii-page-data.json"

  manual_text="$(pdftotext -f 22 -l 30 "$manual_pdf" - 2>/dev/null | tr -d '\r')"
  control_map_text="$(pdftotext -f 425 -l 427 "$manual_pdf" - 2>/dev/null | tr -d '\r')"
  page_text="$(jq -r '.. | objects | .component?.options?.text? // empty' "$product_json")"
  screenshot_url="$(jq -r '.result.data.allBuilderModels.oneAkaiPage.content.screenshot // empty' "$product_json")"

  dimensions_line="$(printf '%s\n' "$page_text" | rg -m1 '411\.5 x 243\.8 x 45\.7 mm' || true)"
  weight_line="$(printf '%s\n' "$page_text" | rg -m1 '3\.38 kg' || true)"
  pads_line="$(printf '%s\n' "$page_text" | rg -m1 '\(16\) velocity- and pressure-sensitive pads' || true)"
  qlink_knobs_line="$(printf '%s\n' "$page_text" | rg -m1 '\(4\) 360° touch-sensitive Q-Link Knobs' || true)"
  qlink_columns_line="$(printf '%s\n' "$page_text" | rg -m1 '\(4\) Q-Link Knob columns accessible via Q-Link button' || true)"

  jq -n \
    --arg manual_url "$(mpc_manual_url)" \
    --arg product_url "$(mpc_product_url)" \
    --arg product_json_url "$(mpc_product_page_data_url)" \
    --arg manual_text "$manual_text" \
    --arg control_map_text "$control_map_text" \
    --arg dimensions_line "$dimensions_line" \
    --arg weight_line "$weight_line" \
    --arg pads_line "$pads_line" \
    --arg qlink_knobs_line "$qlink_knobs_line" \
    --arg qlink_columns_line "$qlink_columns_line" \
    --arg screenshot_url "$screenshot_url" \
    --arg expected_dimensions "$(mpc_expected_dimensions_mm)" \
    --arg expected_weight "$(mpc_expected_weight_kg)" \
    --arg expected_pads "$(mpc_expected_pads)" \
    --arg expected_qlink_knobs "$(mpc_expected_qlink_knobs)" \
    --arg expected_qlink_columns "$(mpc_expected_qlink_columns)" \
    '
    def has(text; needle):
      (text | test(needle; "i"));
    def bool_num(v):
      if v then 1 else 0 end;

    {
      sources: {
        manual_url: $manual_url,
        product_url: $product_url,
        product_json_url: $product_json_url,
        screenshot_url: $screenshot_url
      },
      official: {
        dimensions_mm: (if has($dimensions_line; "411\\.5 x 243\\.8 x 45\\.7 mm") then $expected_dimensions else null end),
        weight_kg: (if has($weight_line; "3\\.38 kg") then ($expected_weight | tonumber) else null end),
        pads: (if has($pads_line; "\\(16\\) velocity- and pressure-sensitive pads") then ($expected_pads | tonumber) else null end),
        qlink_knobs: (if has($qlink_knobs_line; "\\(4\\) 360° touch-sensitive Q-Link Knobs") then ($expected_qlink_knobs | tonumber) else null end),
        qlink_columns: (if has($qlink_columns_line; "\\(4\\) Q-Link Knob columns accessible via Q-Link button") then ($expected_qlink_columns | tonumber) else null end)
      },
      manual: {
        top_panel: (has($manual_text; "MPC Live II\\nTop Panel")),
        rear_panel: (has($manual_text; "Rear Panel")),
        play_start: (has($manual_text; "Play Start")),
        overdub: (has($manual_text; "Overdub")),
        qlink: (has($manual_text; "Q-Link")),
        control_map: (has($control_map_text; "MPC Live II Control Map"))
      },
      raw: {
        manual_excerpt: $manual_text,
        control_map_excerpt: $control_map_text
      }
    }
    '
}

mpc_score_research_json() {
  local research_json cap_reference_path cli_json cli_exit
  local has_cap_reference has_cli_success has_live_export export_path
  research_json="${1:?missing research json path}"
  cap_reference_path="${2:-}"
  cli_json="${3:-}"
  cli_exit="${4:-1}"

  if [[ -n "$cap_reference_path" && -f "$cap_reference_path" ]]; then
    has_cap_reference=true
  else
    has_cap_reference=false
  fi

  if [[ "$cli_exit" -eq 0 ]]; then
    has_cli_success=true
  else
    has_cli_success=false
  fi

  export_path=""
  if [[ -n "$cli_json" && -f "$cli_json" ]]; then
    export_path="$(jq -r '.result.export_path // empty' "$cli_json" 2>/dev/null || true)"
  fi
  if [[ -n "$export_path" && -f "$export_path" ]]; then
    has_live_export=true
  else
    has_live_export=false
  fi

  jq -n \
    --slurpfile data "$research_json" \
    --argjson has_cap_reference "$( [[ "$has_cap_reference" == true ]] && printf 'true' || printf 'false' )" \
    --argjson has_cli_success "$( [[ "$has_cli_success" == true ]] && printf 'true' || printf 'false' )" \
    --argjson has_live_export "$( [[ "$has_live_export" == true ]] && printf 'true' || printf 'false' )" \
    '
    $data[0] as $r |
    def b(x): if x then 1 else 0 end;
    def nonempty(x): (x != null and x != "");

    def percent(found; total):
      if total == 0 then 0 else ((found * 100) / total) end;

    {
      source_coverage_score: (
        percent(
          b(nonempty($r.sources.manual_url)) +
          b(nonempty($r.sources.product_url)) +
          b(nonempty($r.official.dimensions_mm)) +
          b(nonempty($r.official.weight_kg)) +
          b(nonempty($r.official.pads)) +
          b(nonempty($r.official.qlink_knobs)) +
          b(nonempty($r.official.qlink_columns)) +
          b(nonempty($r.sources.screenshot_url));
          8
        )
      ),
      control_anchor_score: (
        percent(
          b($r.manual.top_panel) +
          b($r.manual.rear_panel) +
          b($r.manual.play_start) +
          b($r.manual.overdub) +
          b($r.manual.qlink) +
          b($r.manual.control_map);
          6
        )
      ),
      execution_score: (if $has_cli_success then 100 else 0 end),
      export_artifact_score: (if $has_live_export then 100 else 0 end),
      geometry_calibration_score: (if $has_cap_reference then 100 else 0 end),
      unsupported_geometry_floor: (if $has_cap_reference then 0 else 35 end)
    } as $s
    |
    (($s.source_coverage_score * 35) + ($s.control_anchor_score * 20) + ($s.execution_score * 15) + ($s.export_artifact_score * 10) + ($s.geometry_calibration_score * 20)) / 100
      as $weighted_score
    |
    $weighted_score as $score
    |
    {
      match_score: (if $score < 0 then 0 elif $score > 100 then 100 else ($score | round) end),
      score_components: $s,
      cap_reference_present: $has_cap_reference,
      match_state: (
        if $has_cap_reference and $score >= 85 then "source-backed-match"
        elif $has_live_export and $score >= 70 then "live-demo-reference"
        elif $score >= 60 then "source-backed-reference"
        else "needs-more-evidence"
        end
      )
    }
    '
}
