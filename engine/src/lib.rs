//! ink-engine: parser for the reMarkable `.rm` v6 ("lines") binary format.
//!
//! v6 files are a 43-byte ASCII header followed by length-prefixed blocks.
//! Inside each block, every field is tagged with (index << 4 | type), which
//! lets us walk values generically and stay resilient to unknown fields.
//! For now the engine extracts text highlights (SceneGlyphItemBlock, 0x03):
//! the selected text, color, character range and bounding rectangles.

use serde::Serialize;
use wasm_bindgen::prelude::*;

const HEADER: &[u8] = b"reMarkable .lines file, version=6";
const HEADER_LEN: usize = 43;
const BLOCK_GLYPH_ITEM: u8 = 0x03;

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Highlight {
    pub text: String,
    pub color: u32,
    pub start: i64,
    pub length: i64,
    pub rects: Vec<Rect>,
}

struct Reader<'a> {
    d: &'a [u8],
    p: usize,
}

impl<'a> Reader<'a> {
    fn new(d: &'a [u8]) -> Self {
        Reader { d, p: 0 }
    }
    fn eof(&self) -> bool {
        self.p >= self.d.len()
    }
    fn u8(&mut self) -> Result<u8, String> {
        let b = *self.d.get(self.p).ok_or("eof reading u8")?;
        self.p += 1;
        Ok(b)
    }
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        if self.p + n > self.d.len() {
            return Err(format!("eof taking {n} bytes"));
        }
        let s = &self.d[self.p..self.p + n];
        self.p += n;
        Ok(s)
    }
    fn u16le(&mut self) -> Result<u16, String> {
        let b = self.take(2)?;
        Ok(u16::from_le_bytes([b[0], b[1]]))
    }
    fn u32le(&mut self) -> Result<u32, String> {
        let b = self.take(4)?;
        Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    }
    fn u64le(&mut self) -> Result<u64, String> {
        let b = self.take(8)?;
        Ok(u64::from_le_bytes(b.try_into().unwrap()))
    }
    fn varuint(&mut self) -> Result<u64, String> {
        let mut v: u64 = 0;
        let mut shift = 0u32;
        loop {
            let b = self.u8()?;
            v |= u64::from(b & 0x7f) << shift;
            if b & 0x80 == 0 {
                return Ok(v);
            }
            shift += 7;
            if shift > 63 {
                return Err("varuint too long".into());
            }
        }
    }
}

/// One tagged value: (index, payload). Fixed-size payloads are stored raw;
/// Length4 (0xC) subblocks keep their byte slice; IDs keep both parts.
#[derive(Debug, Clone)]
enum Val<'a> {
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    Sub(&'a [u8]),
    Id(u8, u64),
}

fn walk_tagged<'a>(r: &mut Reader<'a>) -> Result<Vec<(u32, Val<'a>)>, String> {
    let mut out = Vec::new();
    while !r.eof() {
        let tag = r.varuint()?;
        let index = (tag >> 4) as u32;
        let ttype = (tag & 0xF) as u8;
        let val = match ttype {
            0x1 => Val::U8(r.u8()?),
            0x2 => Val::U16(r.u16le()?),
            0x4 => Val::U32(r.u32le()?),
            0x8 => Val::U64(r.u64le()?),
            0xC => {
                let len = r.u32le()? as usize;
                Val::Sub(r.take(len)?)
            }
            0xF => {
                let part1 = r.u8()?;
                let part2 = r.varuint()?;
                Val::Id(part1, part2)
            }
            other => return Err(format!("unknown tag type {other:#x} at index {index}")),
        };
        out.push((index, val));
    }
    Ok(out)
}

/// strings are a subblock of: varuint length, u8 is-ascii flag, bytes
fn parse_string(sub: &[u8]) -> Option<String> {
    let mut r = Reader::new(sub);
    let len = r.varuint().ok()? as usize;
    let _is_ascii = r.u8().ok()?;
    let bytes = r.take(len).ok()?;
    if !r.eof() {
        return None; // trailing bytes → this wasn't a string
    }
    String::from_utf8(bytes.to_vec()).ok()
}

/// rectangles are a subblock of: varuint count, then count × 4 f64 (x, y, w, h)
fn parse_rects(sub: &[u8]) -> Option<Vec<Rect>> {
    let mut r = Reader::new(sub);
    let count = r.varuint().ok()? as usize;
    if count == 0 || count > 10_000 {
        return None;
    }
    let need = count.checked_mul(32)?;
    if sub.len() - r.p != need {
        return None; // wrong size → not a rect list
    }
    let mut rects = Vec::with_capacity(count);
    for _ in 0..count {
        let x = f64::from_le_bytes(r.take(8).ok()?.try_into().unwrap());
        let y = f64::from_le_bytes(r.take(8).ok()?.try_into().unwrap());
        let w = f64::from_le_bytes(r.take(8).ok()?.try_into().unwrap());
        let h = f64::from_le_bytes(r.take(8).ok()?.try_into().unwrap());
        rects.push(Rect { x, y, w, h });
    }
    Some(rects)
}

fn u32_at(vals: &[(u32, Val)], index: u32) -> Option<u32> {
    vals.iter().find_map(|(i, v)| match (i, v) {
        (ix, Val::U32(n)) if *ix == index => Some(*n),
        _ => None,
    })
}

/// A glyph (text highlight) item block: standard scene-item envelope with the
/// GlyphRange value inside subblock index 6.
fn parse_glyph_block(payload: &[u8]) -> Result<Option<Highlight>, String> {
    let mut r = Reader::new(payload);
    let vals = walk_tagged(&mut r)?;
    let value_sub = vals.iter().find_map(|(i, v)| match (i, v) {
        (6, Val::Sub(s)) => Some(*s),
        _ => None,
    });
    let Some(sub) = value_sub else {
        return Ok(None); // deleted / tombstoned item carries no value
    };
    let mut vr = Reader::new(sub);
    // the value subblock opens with one RAW (untagged) item-type byte
    let item_type = vr.u8()?;
    if item_type != 0x01 {
        return Ok(None); // not a glyph value after all
    }
    let gvals = walk_tagged(&mut vr)?;

    let mut text: Option<String> = None;
    let mut rects: Option<Vec<Rect>> = None;
    for (_, v) in &gvals {
        if let Val::Sub(s) = v {
            if text.is_none() {
                if let Some(t) = parse_string(s) {
                    text = Some(t);
                    continue;
                }
            }
            if rects.is_none() {
                if let Some(rs) = parse_rects(s) {
                    rects = Some(rs);
                }
            }
        }
    }
    let Some(text) = text else { return Ok(None) };
    Ok(Some(Highlight {
        text,
        color: u32_at(&gvals, 4).unwrap_or(0),
        start: u32_at(&gvals, 2).map(i64::from).unwrap_or(-1),
        length: u32_at(&gvals, 3).map(i64::from).unwrap_or(-1),
        rects: rects.unwrap_or_default(),
    }))
}

pub fn extract_highlights(data: &[u8]) -> Result<Vec<Highlight>, String> {
    if data.len() < HEADER_LEN || &data[..HEADER.len()] != HEADER {
        return Err("not a .rm v6 file".into());
    }
    let mut r = Reader::new(&data[HEADER_LEN..]);
    let mut out = Vec::new();
    while !r.eof() {
        let len = r.u32le()? as usize;
        let _unknown = r.u8()?;
        let _min_version = r.u8()?;
        let _current_version = r.u8()?;
        let block_type = r.u8()?;
        let payload = r.take(len)?;
        if block_type == BLOCK_GLYPH_ITEM {
            if let Some(h) = parse_glyph_block(payload)? {
                out.push(h);
            }
        }
    }
    Ok(out)
}

#[wasm_bindgen]
pub fn highlights_json(data: &[u8]) -> String {
    match extract_highlights(data) {
        Ok(hl) => serde_json::to_string(&hl).unwrap_or_else(|_| "[]".into()),
        Err(e) => format!("{{\"error\":{}}}", serde_json::to_string(&e).unwrap()),
    }
}

#[wasm_bindgen]
pub fn engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fixture_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../engine-fixtures")
    }

    // fixtures are personal data, gitignored; skip when absent
    #[test]
    fn matches_rmscene_oracle() {
        let dir = fixture_dir();
        let oracle_path = dir.join("oracle.json");
        if !oracle_path.exists() {
            eprintln!("fixtures missing — skipping oracle test");
            return;
        }
        let oracle: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&oracle_path).unwrap()).unwrap();
        let mut pages = 0;
        let mut total = 0;
        for (file, expected) in oracle.as_object().unwrap() {
            let data = std::fs::read(dir.join(file)).unwrap();
            let got = extract_highlights(&data).unwrap();
            let exp = expected.as_array().unwrap();
            assert_eq!(got.len(), exp.len(), "highlight count mismatch in {file}");
            for (g, e) in got.iter().zip(exp) {
                assert_eq!(g.text, e["text"].as_str().unwrap(), "text mismatch in {file}");
                assert_eq!(g.color as i64, e["color"].as_i64().unwrap());
                assert_eq!(g.start, e["start"].as_i64().unwrap());
                assert_eq!(g.length, e["length"].as_i64().unwrap());
                assert_eq!(g.rects.len(), e["rects"].as_array().unwrap().len());
            }
            pages += 1;
            total += got.len();
        }
        assert!(pages >= 4 && total >= 16, "expected the full fixture set");
    }

    #[test]
    fn rejects_garbage() {
        assert!(extract_highlights(b"not a lines file").is_err());
    }
}
