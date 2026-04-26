"""SVG loading and light DOM inspection.

Phase 2B-1 populates only the minimum the scan_runner dispatcher needs:
- parse bytes -> lxml tree
- expose viewBox, width/height (raw strings with their units)
- expose iterable of <path>, <text>, <image> elements

Subsequent sub-phases (2B-2 onwards) extend SvgDocument with whatever
each rule group needs. Per Lesson #44 - no speculative fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

from lxml import etree  # type: ignore

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"


@dataclass(frozen=True)
class SvgDocument:
    """Parsed SVG wrapper. Frozen - rules receive a read-only view.

    Phase 2B-1 fields only. Rule groups that need more (e.g. path geometry,
    stroke attributes, layer trees) will extend this dataclass in their
    sub-phase rather than pre-adding unused fields now.
    """

    root: etree._Element
    # Phase 8.1d-12: raw_bytes kept around so worker.svg_bbox can
    # re-render via cairosvg for the R-SVG-01 content-bbox check
    # without re-downloading from storage. Lxml round-trips
    # `etree.tostring(root)` are subtly lossy on namespace decls so
    # we just carry the original bytes through.
    raw_bytes: bytes
    # Raw attribute strings preserved with their units. Parsing into
    # mm / px / percent is the job of R-SVG-02 / R-SVG-03 in Phase 2B-2.
    width_raw: str | None
    height_raw: str | None
    # (min-x, min-y, width, height) in viewBox's own unit space.
    viewbox: tuple[float, float, float, float] | None

    def paths(self) -> Iterator[etree._Element]:
        yield from self.root.iter(f"{{{SVG_NS}}}path")

    def texts(self) -> Iterator[etree._Element]:
        yield from self.root.iter(f"{{{SVG_NS}}}text")

    def images(self) -> Iterator[etree._Element]:
        yield from self.root.iter(f"{{{SVG_NS}}}image")


def load_svg_document(data: bytes) -> SvgDocument:
    """Parse SVG bytes -> SvgDocument.

    Raises ValueError on unparseable input. Worker's outer scan loop
    catches that into scan_status='error' with a structured scan_error.
    """
    try:
        root = etree.fromstring(data)
    except etree.XMLSyntaxError as e:
        raise ValueError(f"SVG parse failed: {e}") from e

    # Accept either namespaced <{svg-ns}svg> or legacy unnamespaced <svg>.
    tag = root.tag if isinstance(root.tag, str) else ""
    if not (tag.endswith("}svg") or tag == "svg"):
        raise ValueError(f"root is not <svg>: {tag!r}")

    vb_raw = root.get("viewBox")
    viewbox: tuple[float, float, float, float] | None = None
    if vb_raw:
        parts = vb_raw.strip().replace(",", " ").split()
        if len(parts) == 4:
            try:
                viewbox = (
                    float(parts[0]),
                    float(parts[1]),
                    float(parts[2]),
                    float(parts[3]),
                )
            except ValueError:
                # Malformed viewBox attribute - leave as None, rules will
                # handle the missing-viewBox case explicitly.
                viewbox = None

    return SvgDocument(
        root=root,
        raw_bytes=data,
        width_raw=root.get("width"),
        height_raw=root.get("height"),
        viewbox=viewbox,
    )
