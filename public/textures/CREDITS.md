# Texture credits

All photo textures in this folder are **CC0 1.0 (public domain)**, downloaded from
[Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com) at 1k resolution and
re-encoded as JPG (`diff.jpg` = sRGB albedo, `nor.jpg` = OpenGL normal map, `rough.jpg` = roughness).
WebP copies (`*.webp`, and `diff-512.webp` for phones) are made from these by `npm run textures`
(scripts/textures.mjs); the app loads them where they exist and falls back to the JPGs.
Attribution is not required by the licence; it is given here as thanks.

Procedural textures (Persian rugs, damask wallpaper, books, paintings, quilt, pegboard) are drawn
at runtime in `engine/textures.js` and need no credit.

| Folder | Asset | Author(s) | Source | Licence | Notes |
|---|---|---|---|---|---|
| `woodFloor/` | Wood Floor (`wood_floor`) | Dimitrios Savva | [Poly Haven](https://polyhaven.com/a/wood_floor) | CC0 1.0 |  |
| `herringbone/` | Herringbone Parquet (`herringbone_parquet`) | Jenelle van Heerden, Sergej Majboroda | [Poly Haven](https://polyhaven.com/a/herringbone_parquet) | CC0 1.0 |  |
| `woodDark/` | Dark Wooden Planks (`dark_wooden_planks`) | Amal Kumar | [Poly Haven](https://polyhaven.com/a/dark_wooden_planks) | CC0 1.0 |  |
| `walnut/` | Walnut Veneer (`walnut_veneer`) | Jenelle van Heerden | [Poly Haven](https://polyhaven.com/a/walnut_veneer) | CC0 1.0 |  |
| `oak/` | Oak Veneer 01 (`oak_veneer_01`) | Jenelle van Heerden | [Poly Haven](https://polyhaven.com/a/oak_veneer_01) | CC0 1.0 |  |
| `mahogany/` | Sapele Veneer (`sapele_veneer`) | Jenelle van Heerden | [Poly Haven](https://polyhaven.com/a/sapele_veneer) | CC0 1.0 |  |
| `cherry/` | Cherry Veneer (`cherry_veneer`) | Jenelle van Heerden | [Poly Haven](https://polyhaven.com/a/cherry_veneer) | CC0 1.0 |  |
| `teak/` | Teak Veneer (`teak_veneer`) | Jenelle van Heerden | [Poly Haven](https://polyhaven.com/a/teak_veneer) | CC0 1.0 |  |
| `marbleWhite/` | Marble021 (`Marble021`) | ambientCG (Lennart Demes) | [ambientCG](https://ambientcg.com/view?id=Marble021) | CC0 1.0 |  |
| `marbleDark/` | Marble006 (`Marble006`) | ambientCG (Lennart Demes) | [ambientCG](https://ambientcg.com/view?id=Marble006) | CC0 1.0 |  |
| `travertine/` | Travertine009 (`Travertine009`) | ambientCG (Lennart Demes) | [ambientCG](https://ambientcg.com/view?id=Travertine009) | CC0 1.0 |  |
| `limestone/` | Marble 01 (`marble_01`) | Rob Tuytel | [Poly Haven](https://polyhaven.com/a/marble_01) | CC0 1.0 |  |
| `plaster/` | White Stucco (`white_stucco`) | Amal Kumar | [Poly Haven](https://polyhaven.com/a/white_stucco) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `plasterExt/` | White Stucco 02 (`white_stucco_02`) | Dimitrios Savva | [Poly Haven](https://polyhaven.com/a/white_stucco_02) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `stone/` | Yellow Stone Wall (`yellow_stone_wall`) | Sơn Nguyễn | [Poly Haven](https://polyhaven.com/a/yellow_stone_wall) | CC0 1.0 |  |
| `roofTiles/` | Clay Roof Tiles 02 (`clay_roof_tiles_02`) | Amal Kumar | [Poly Haven](https://polyhaven.com/a/clay_roof_tiles_02) | CC0 1.0 |  |
| `grass/` | Grass005 (`Grass005`) | ambientCG (Lennart Demes) | [ambientCG](https://ambientcg.com/view?id=Grass005) | CC0 1.0 |  |
| `gravel/` | Gravel Floor (`gravel_floor`) | Jenelle van Heerden, Matterfield | [Poly Haven](https://polyhaven.com/a/gravel_floor) | CC0 1.0 |  |
| `concrete/` | Concrete Floor 01 (`concrete_floor_01`) | Rob Tuytel | [Poly Haven](https://polyhaven.com/a/concrete_floor_01) | CC0 1.0 |  |
| `concretePolished/` | Concrete034 (`Concrete034`) | ambientCG (Lennart Demes) | [ambientCG](https://ambientcg.com/view?id=Concrete034) | CC0 1.0 |  |
| `velvet/` | Velour Velvet (`velour_velvet`) | colormass, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/velour_velvet) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `linen/` | Rough Linen (`rough_linen`) | colormass, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/rough_linen) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `boucle/` | Curly Teddy Natural (`curly_teddy_natural`) | colormass, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/curly_teddy_natural) | CC0 1.0 |  |
| `knit/` | Knitted Fleece (`knitted_fleece`) | colormass, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/knitted_fleece) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `leather/` | Brown Leather (`brown_leather`) | Rob Tuytel | [Poly Haven](https://polyhaven.com/a/brown_leather) | CC0 1.0 | diffuse converted to neutral luminance detail map (tinted in code) |
| `jute/` | Hessian 230 (`hessian_230`) | colormass, Rico Cilliers | [Poly Haven](https://polyhaven.com/a/hessian_230) | CC0 1.0 |  |
| `granite/` | Granite Tile (`granite_tile`) | Charlotte Baglioni | [Poly Haven](https://polyhaven.com/a/granite_tile) | CC0 1.0 |  |
| `tileBath/` | Interior Tiles (`interior_tiles`) | Charlotte Baglioni | [Poly Haven](https://polyhaven.com/a/interior_tiles) | CC0 1.0 |  |
| `terracottaTile/` | Terracotta Floor Tiles (`terracotta_floor_tiles`) | Dimitrios Savva | [Poly Haven](https://polyhaven.com/a/terracotta_floor_tiles) | CC0 1.0 |  |
| `asphalt/` | Asphalt Floor (`asphalt_floor`) | eye-candy.xyz | [Poly Haven](https://polyhaven.com/a/asphalt_floor) | CC0 1.0 |  |
| `rubber/` | Rubber Tiles (`rubber_tiles`) | Amal Kumar | [Poly Haven](https://polyhaven.com/a/rubber_tiles) | CC0 1.0 |  |
