# Firetoy Stylized Battle Royale Characters — mapa técnico del asset

Documento de inspección para la futura integración en React Three Fiber.

**Alcance:** análisis del asset Unity, sus modelos, prefabs, scripts, materiales, texturas, documentación, metadatos y de los dos GLB ya exportados.  
**No incluye:** implementación, código de producción ni cambios en Aura Battle.  
**Fecha de inspección:** 2026-09-01.

---

## 0. Resumen ejecutivo para Claude

El pack contiene **dos personajes base separados**, uno masculino y otro femenino:

- `Ib_MALE_01.fbx`
- `Ib_FEMALE_01.fbx`

Cada FBX contiene un único esqueleto humanoide y todas sus piezas modulares como `SkinnedMeshRenderer` superpuestos. Los dos GLB de Aura Battle conservan esa arquitectura:

- `firetoy-male.glb`: 1 armature, 65 joints, 166 nodos de mesh.
- `firetoy-female.glb`: 1 armature, 65 joints, 144 nodos de mesh.

La correspondencia de piezas es excepcionalmente directa:

```text
Unity Prefabs/Parts_<Gender>/<nombre>.prefab
→ GameObject/SkinnedMeshRenderer del FBX <nombre>
→ nodo skinned del GLB <nombre>
```

La igualdad de nombres es exacta para las **166/166 piezas masculinas** y las **144/144 femeninas**, incluida una errata con punto final. En el GLB se debe identificar cada pieza por el **nombre del nodo/Object3D**, no por el nombre interno del recurso `mesh`, que Blender renombró de forma genérica.

El sistema del creador no combina geometrías ni aplica reglas automáticas: simplemente desactiva todos los modelos y activa una opción por categoría. Por tanto:

- Los GLB arrancan con todas las piezas presentes; la futura integración tendrá que gestionar su visibilidad.
- Los objetos vacíos que Unity usa como opción “ninguna” no existen en los GLB. “Ninguna” debe representarse como ausencia de selección.
- Las variantes terminadas en `_1`, `_2` y `_3` son colorways/paletas del mismo diseño.
- No hay sistema de recoloreado dinámico en el pack.
- Los presets originales aportan convenciones reales de compatibilidad, pero el script no las impone.

Las excepciones que más fácilmente pueden provocar errores son:

1. `Ib_MALE_01_Male_Eyebrows_10_1.` termina literalmente en un punto.
2. Las manos desnudas masculinas son un único mesh combinado; las femeninas son izquierda y derecha por separado.
3. Los presets masculinos 05, 08 y 09 no activan `Male_Eyes`.
4. El preset masculino 07 combina deliberadamente pelo y sombrero.
5. `Female_Eyelashes` solo aparece en los presets femeninos 01 y 09.
6. El preset femenino 01 combina `Female_Bra` con `Torso_1_1`.
7. `Male_Body` y `Fem_Body` no están activos en ningún preset original ni expuestos por el personalizador.

---

## 1. Fuentes inspeccionadas y grado de certeza

### Ubicaciones

El pack Unity completo se inspeccionó desde una copia local del asset
comprado, fuera de este repositorio. Ni el pack ni el ZIP forman parte de Aura
Battle.

Los GLB comparados son los que el juego carga en desarrollo:

```text
public/models/characters/firetoy-male.glb
public/models/characters/firetoy-female.glb
```

Las copias que acompañan al pack fuente son idénticas byte a byte a estas.

### Evidencia utilizada

- Árbol completo del ZIP.
- YAML de todos los prefabs de personajes y piezas.
- `.meta` de FBX, materiales, texturas, scripts y prefabs.
- `CharacterCustomizationManager.cs` y scripts de UI relacionados.
- `Documentation.pdf` y `_Readme.txt`.
- Estructura binaria glTF, nodos, skins, materiales, imágenes y atributos de ambos GLB.
- Resolución de referencias Unity `GUID/fileID`, incluida la tabla de identificadores internos de los FBX.
- Inspección visual de iconos y variantes.

### Convenciones de certeza

- **Confirmado:** deriva directamente de nombres, YAML, GUID/fileID, datos glTF o contenido documental.
- **Convención observada:** se cumple en los presets, pero no está impuesta por código.
- **Interpretación visual:** describe la apariencia; no es una categoría oficial del creador.
- **No determinado:** el asset no contiene evidencia suficiente.

---

## 2. Estructura general del pack

### Carpetas relevantes

| Ruta del pack | Contenido |
|---|---|
| `Models` | Los 2 FBX maestros y sus `.meta`. |
| `Prefabs/Characters_Male` | 10 presets masculinos: `Ib_MALE_01.prefab` a `Ib_MALE_10.prefab`. |
| `Prefabs/Characters_Female` | 10 presets femeninos: `Ib_FEMALE_01.prefab` a `Ib_FEMALE_10.prefab`. |
| `Prefabs/Parts_Male` | 166 prefabs de pieza, uno por cada mesh masculino. |
| `Prefabs/Parts_Female` | 144 prefabs de pieza, uno por cada mesh femenino. |
| `Prefabs/Ib_MALE.prefab` | Personaje masculino completo configurado para el personalizador. |
| `Prefabs/Ib_FEMALE.prefab` | Personaje femenino completo configurado para el personalizador. |
| `Scripts/Character` | `CharacterCustomizationManager.cs`. |
| `Scripts/UI` | Renderizado de categorías/opciones y botón de animación. |
| `Materials` | Un material lógico por género. |
| `Textures` | Un atlas nominal por género; los dos PNG son idénticos. |
| `Sprites` | Un icono por opción/pieza y un `EmptyIcon.png`. |
| `Documentation` | PDF de configuración y readme de soporte. |
| `Pipeline` | Paquetes auxiliares para URP/HDRP. |

Los `.meta` identifican el paquete como `Stylized Battle Royale Characters`, versión 1.0, product ID 329174.

### Modelos fuente

| Modelo | Tamaño | GUID Unity | Importación |
|---|---:|---|---|
| `Models/Ib_MALE_01.fbx` | 18,557,372 bytes | `a917100437827784596091cb6c58f620` | Humanoid, sin animaciones. |
| `Models/Ib_FEMALE_01.fbx` | 18,023,292 bytes | `17f1d882547eea44993a2a6125934907` | Humanoid, sin animaciones. |

Configuración común relevante de `ModelImporter`:

- `animationType: 3` — Humanoid.
- `importAnimation: 0` — el pack no importa clips desde estos FBX.
- `avatarSetup: 1`.
- `optimizeBones: 1`.
- máximo de 4 influencias por vértice.
- blend shapes desactivados.
- jerarquía ordenada por nombre.
- `isReadable: 0`.

El masculino declara de forma explícita el mapeo humanoide completo. El `.meta` femenino deja `human: []` y habilita la generación automática del avatar.

### Armature/esqueleto

Los dos GLB tienen un nodo raíz `Armature`, un único skin y la misma jerarquía de **65 joints**. Resumen:

```text
Hips
├─ Spine → Spine1 → Spine2 → Neck → Head → HeadTop_End
│  ├─ Shoulder.L → Arm.L → ForeArm.L → Hand.L
│  │  ├─ Thumb1.L … Thumb4.L
│  │  ├─ Index1.L … Index4.L
│  │  ├─ Middle1.L … Middle4.L
│  │  ├─ Ring1.L … Ring4.L
│  │  └─ Pinky1.L … Pinky4.L
│  └─ Shoulder.R → Arm.R → ForeArm.R → Hand.R
│     └─ las mismas cinco cadenas de dedos, sufijo .R
├─ UpLeg.L → Leg.L → Foot.L → ToeBase.L → Toe_End.L
└─ UpLeg.R → Leg.R → Foot.R → ToeBase.R → Toe_End.R
```

Todos los nodos de pieza del GLB son hijos directos de `Armature` y referencian el mismo skin. No hay animaciones ni morph targets dentro de los GLB.

### Diferencias estructurales male/female

| Tema | Male | Female |
|---|---|---|
| Meshes/prefabs de pieza | 166 | 144 |
| Barbas | 24 | No existen |
| Diseños de pelo | 5 × 3 | 4 × 3 |
| Diseños de calzado | 5 × 3 | 6 × 3 |
| Manos base | Un mesh combinado `Male_Hands` | `Female_Left_Hand` y `Female_Right_Hand` |
| Ropa interior superior | `Male_Torso` | `Female_Bra` |
| Pestañas | No hay mesh separado | `Female_Eyelashes` |
| Body base | `Male_Body` | `Fem_Body` |
| Categorías del personalizador | 15 | 14 |

---

## 3. Naming conventions

### Forma general

```text
Ib_MALE_01_<Category>_<design>_<colorway>[_Left|_Right]
Ib_FEMALE_01_<Category>_<design>_<colorway>[_Left|_Right]
```

- El primer índice después de la categoría identifica el **diseño/forma**.
- El último índice `1..3` identifica uno de los **tres colorways**.
- Los guantes añaden `_Left` o `_Right`.
- Las piezas anatómicas base no siempre llevan índices.
- El casing y los guiones bajos deben conservarse exactamente.

En las tablas, una expresión como:

```text
Ib_MALE_01_Beard_{1..8}_{1..3}
```

representa el producto cartesiano completo: 8 diseños × 3 colorways = 24 nombres reales.

### Excepción literal

```text
Ib_MALE_01_Male_Eyebrows_10_1.
```

El punto final forma parte del nombre del prefab, GameObject y nodo GLB. No debe corregirse en un mapping automático.

### Taxonomía que NO existe

No hay nombres técnicos separados para:

- `Jacket`
- `Top`
- `Accessory`
- `Chain`

Las prendas superiores, incluidas las que visualmente parecen chaquetas, pertenecen a `Torso`. “Accessories” solo puede usarse como agrupación de producto propia de Aura Battle, no como categoría fuente de Firetoy.

---

## 4. Inventario exacto de piezas

### 4.1 Male — 166 piezas

| Categoría técnica | Nombres exactos/patrón | Diseños | Colorways | Total |
|---|---|---:|---:|---:|
| Beard | `Ib_MALE_01_Beard_{1..8}_{1..3}` | 8 | 3 | 24 |
| Fullbody | `Ib_MALE_01_Full_Body_1_{1..3}` | 1 | 3 | 3 |
| Glasses | `Ib_MALE_01_Glasses_{1..2}_{1..3}` | 2 | 3 | 6 |
| Gloves | `Ib_MALE_01_Gloves_{1..2}_{1..3}_{Left|Right}` | 2 | 3 | 12 meshes / 6 pares |
| Hair | `Ib_MALE_01_Hair_{1..5}_{1..3}` | 5 | 3 | 15 |
| Hats | `Ib_MALE_01_Hat_{1..4}_{1..3}` | 4 | 3 | 12 |
| Headphones | `Ib_MALE_01_Headphones_1_{1..3}` | 1 | 3 | 3 |
| Eyebrows | `Ib_MALE_01_Male_Eyebrows_{1..11}_{1..3}` | 11 | 3 | 33 |
| Masks | `Ib_MALE_01_Mask_{1..2}_{1..3}` | 2 | 3 | 6 |
| Pants | `Ib_MALE_01_Pants_{1..5}_{1..3}` | 5 | 3 | 15 |
| Shoes | `Ib_MALE_01_Shoes_{1..5}_{1..3}` | 5 | 3 | 15 |
| Torso | `Ib_MALE_01_Torso_{1..5}_{1..3}` | 5 | 3 | 15 |
| Base/anatomía | Lista siguiente | — | — | 7 |

En la familia Eyebrows debe sustituirse la expansión `..._10_1` por el nombre literal `..._10_1.`.

Piezas base masculinas:

```text
Ib_MALE_01_Male_Body
Ib_MALE_01_Male_Eyes
Ib_MALE_01_Male_Feet
Ib_MALE_01_Male_Hands
Ib_MALE_01_Male_Head
Ib_MALE_01_Male_Torso
Ib_MALE_01_Male_Underwear
```

### 4.2 Female — 144 piezas

| Categoría técnica | Nombres exactos/patrón | Diseños | Colorways | Total |
|---|---|---:|---:|---:|
| Eyebrows | `Ib_FEMALE_01_Female_Eyebrows_{1..11}_{1..3}` | 11 | 3 | 33 |
| Fullbody | `Ib_FEMALE_01_Full_Body_1_{1..3}` | 1 | 3 | 3 |
| Glasses | `Ib_FEMALE_01_Glasses_{1..2}_{1..3}` | 2 | 3 | 6 |
| Gloves | `Ib_FEMALE_01_Gloves_{1..2}_{1..3}_{Left|Right}` | 2 | 3 | 12 meshes / 6 pares |
| Hair | `Ib_FEMALE_01_Hair_{1..4}_{1..3}` | 4 | 3 | 12 |
| Hats | `Ib_FEMALE_01_Hat_{1..4}_{1..3}` | 4 | 3 | 12 |
| Headphones | `Ib_FEMALE_01_Headphones_1_{1..3}` | 1 | 3 | 3 |
| Masks | `Ib_FEMALE_01_Mask_{1..2}_{1..3}` | 2 | 3 | 6 |
| Pants | `Ib_FEMALE_01_Pants_{1..5}_{1..3}` | 5 | 3 | 15 |
| Shoes | `Ib_FEMALE_01_Shoes_{1..6}_{1..3}` | 6 | 3 | 18 |
| Torso | `Ib_FEMALE_01_Torso_{1..5}_{1..3}` | 5 | 3 | 15 |
| Base/anatomía | Lista siguiente | — | — | 9 |

Piezas base femeninas:

```text
Ib_FEMALE_01_Fem_Body
Ib_FEMALE_01_Female_Bra
Ib_FEMALE_01_Female_Eyelashes
Ib_FEMALE_01_Female_Eyes
Ib_FEMALE_01_Female_Feet
Ib_FEMALE_01_Female_Head
Ib_FEMALE_01_Female_Left_Hand
Ib_FEMALE_01_Female_Right_Hand
Ib_FEMALE_01_Female_Underwear
```

### 4.3 Categorías del personalizador del creador

Estas categorías proceden de los arrays serializados en `Prefabs/Ib_MALE.prefab` e `Ib_FEMALE.prefab`, no de una taxonomía inferida.

#### Male

| Orden | Categoría serializada | Opción base/“ninguna” | Opciones de pieza |
|---:|---|---|---:|
| 1 | Beards | objeto vacío `Ib_MALE_01_Beards` | 24 |
| 2 | Eyebrows | objeto vacío `Ib_MALE_01_Eyebrows` | 33 |
| 3 | Glasses | objeto vacío `Ib_MALE_01_Glasses` | 6 |
| 4 | Fullbody | objeto vacío `Ib_MALE_01_Fullbody` | 3 |
| 5 | Hair | objeto vacío `Ib_MALE_01_Hair` | 15 |
| 6 | Hats | objeto vacío `Ib_MALE_01_Hats` | 12 |
| 7 | Masks | objeto vacío `Ib_MALE_01_Masks` | 6 |
| 8 | Shoes | `Ib_MALE_01_Male_Feet` | 15 |
| 9 | Hand Left | `Ib_MALE_01_Male_Hands` | 6 izquierdos |
| 10 | Hand Right | el mismo `Ib_MALE_01_Male_Hands` | 6 derechos |
| 11 | Headphones | objeto vacío `Ib_MALE_01_Headphones` | 3 |
| 12 | Pants | `Ib_MALE_01_Male_Underwear` | 15 |
| 13 | Torso | `Ib_MALE_01_Male_Torso` | 15 |
| 14 | Head | `Ib_MALE_01_Male_Head` | 1 |
| 15 | Eyes | `Ib_MALE_01_Male_Eyes` | 1 |

La categoría Eyes tiene el modelo correcto, pero sus campos serializados `name`, `id` y `description` están vacíos.

#### Female

| Orden | Categoría serializada | Opción base/“ninguna” | Opciones de pieza |
|---:|---|---|---:|
| 1 | Eyebrows | objeto vacío `Ib_FEMALE_01_Eyebrows` | 33 |
| 2 | Glasses | objeto vacío `Ib_FEMALE_01_Glasses` | 6 |
| 3 | Fullbody | objeto vacío `Ib_FEMALE_01_Fullbody` | 3 |
| 4 | Hair | objeto vacío `Ib_FEMALE_01_Hair` | 12 |
| 5 | Hats | objeto vacío `Ib_FEMALE_01_Hats` | 12 |
| 6 | Headphones | objeto vacío `Ib_FEMALE_01_Headphones` | 3 |
| 7 | Masks | objeto vacío `Ib_FEMALE_01_Masks` | 6 |
| 8 | Shoes | `Ib_FEMALE_01_Female_Feet` | 18 |
| 9 | Hand Left | `Ib_FEMALE_01_Female_Left_Hand` | 6 izquierdos |
| 10 | Hand Right | `Ib_FEMALE_01_Female_Right_Hand` | 6 derechos |
| 11 | Pants | `Ib_FEMALE_01_Female_Underwear` | 15 |
| 12 | Torso | `Ib_FEMALE_01_Female_Bra` | 15 |
| 13 | Head | `Ib_FEMALE_01_Female_Head` | 1 |
| 14 | Eyes | `Ib_FEMALE_01_Female_Eyes` | 1 |

`Female_Eyelashes` y `Fem_Body` existen como meshes, pero no están expuestos como categorías/opciones del personalizador.

---

## 5. Presets originales de Firetoy

### Cómo leer esta sección

Las tablas listan **solo los meshes activos** en cada prefab. `—` significa que el prefab no activa ninguna pieza de esa categoría. No se han completado huecos por intuición.

Los nombres de preset son los nombres reales de archivo:

- Male: `Characters_Male/Ib_MALE_01.prefab` … `Ib_MALE_10.prefab`.
- Female: `Characters_Female/Ib_FEMALE_01.prefab` … `Ib_FEMALE_10.prefab`.

### 5.1 Presets male

#### Ib_MALE_01

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_1_1`, `Ib_MALE_01_Beard_1_1`
- Pelo/sombrero: `Ib_MALE_01_Hair_1_1`; Hat —
- Cara/audio: `Ib_MALE_01_Glasses_1_1`, `Ib_MALE_01_Headphones_1_1`; Mask —
- Vestimenta: `Ib_MALE_01_Full_Body_1_1`; Torso/Pants/Shoes —
- Manos: `Ib_MALE_01_Gloves_1_1_Left` + `Ib_MALE_01_Gloves_1_1_Right`

#### Ib_MALE_02

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_2_1`, `Ib_MALE_01_Beard_2_2`
- Pelo/sombrero: `Ib_MALE_01_Hair_2_2`; Hat —
- Cara/audio: `Ib_MALE_01_Headphones_1_3`; Glasses/Mask —
- Vestimenta: `Ib_MALE_01_Full_Body_1_3`; Torso/Pants/Shoes —
- Manos: `Ib_MALE_01_Gloves_2_1_Left` + `Ib_MALE_01_Gloves_2_1_Right`

#### Ib_MALE_03

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_3_1`, `Ib_MALE_01_Beard_2_1`
- Pelo/sombrero: `Ib_MALE_01_Hair_3_1`; Hat —
- Cara/audio: `Ib_MALE_01_Mask_1_1`; Glasses/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_1_1`, `Ib_MALE_01_Pants_1_1`, `Ib_MALE_01_Shoes_1_1`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_2_2_Left` + `Ib_MALE_01_Gloves_2_2_Right`

#### Ib_MALE_04

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_4_1`, `Ib_MALE_01_Beard_3_1`
- Pelo/sombrero: Hair —; `Ib_MALE_01_Hat_2_3`
- Cara/audio: `Ib_MALE_01_Glasses_2_1`; Mask/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_2_1`, `Ib_MALE_01_Pants_2_2`, `Ib_MALE_01_Shoes_2_1`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_1_3_Left` + `Ib_MALE_01_Gloves_1_3_Right`

#### Ib_MALE_05

- Anatomía: `Ib_MALE_01_Male_Head`; **Eyes —**
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_5_1`, `Ib_MALE_01_Beard_5_1`
- Pelo/sombrero: `Ib_MALE_01_Hair_5_1`; Hat —
- Cara/audio: `Ib_MALE_01_Mask_1_3`; Glasses/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_3_1`, `Ib_MALE_01_Pants_3_1`, `Ib_MALE_01_Shoes_3_1`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_1_1_Left` + `Ib_MALE_01_Gloves_1_1_Right`

#### Ib_MALE_06

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_6_1`, `Ib_MALE_01_Beard_6_1`
- Pelo/sombrero: Hair —; `Ib_MALE_01_Hat_4_2`
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_5_3`, `Ib_MALE_01_Pants_3_2`, `Ib_MALE_01_Shoes_2_3`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_2_2_Left` + `Ib_MALE_01_Gloves_2_2_Right`

#### Ib_MALE_07

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_7_1`, `Ib_MALE_01_Beard_7_1`
- Pelo/sombrero: **`Ib_MALE_01_Hair_4_1` + `Ib_MALE_01_Hat_3_2`**
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_3_2`, `Ib_MALE_01_Pants_1_1`, `Ib_MALE_01_Shoes_2_3`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_2_1_Left` + `Ib_MALE_01_Gloves_2_1_Right`

#### Ib_MALE_08

- Anatomía: `Ib_MALE_01_Male_Head`; **Eyes —**
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_8_3`, `Ib_MALE_01_Beard_8_1`
- Pelo/sombrero: `Ib_MALE_01_Hair_5_2`; Hat —
- Cara/audio: `Ib_MALE_01_Mask_2_2`, `Ib_MALE_01_Headphones_1_3`; Glasses —
- Vestimenta: `Ib_MALE_01_Torso_4_2`, `Ib_MALE_01_Pants_2_2`, `Ib_MALE_01_Shoes_3_2`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_2_3_Left` + `Ib_MALE_01_Gloves_2_3_Right`

#### Ib_MALE_09

- Anatomía: `Ib_MALE_01_Male_Head`; **Eyes —**
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_10_1.`, `Ib_MALE_01_Beard_8_3`
- Pelo/sombrero: Hair —; `Ib_MALE_01_Hat_3_1`
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_2_2`, `Ib_MALE_01_Pants_3_1`, `Ib_MALE_01_Shoes_4_1`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_1_3_Left` + `Ib_MALE_01_Gloves_1_3_Right`

#### Ib_MALE_10

- Anatomía: `Ib_MALE_01_Male_Head`, `Ib_MALE_01_Male_Eyes`
- Cejas/barba: `Ib_MALE_01_Male_Eyebrows_5_2`, `Ib_MALE_01_Beard_6_2`
- Pelo/sombrero: Hair —; `Ib_MALE_01_Hat_2_2`
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_MALE_01_Torso_3_2`, `Ib_MALE_01_Pants_3_2`, `Ib_MALE_01_Shoes_3_2`; Fullbody —
- Manos: `Ib_MALE_01_Gloves_2_2_Left` + `Ib_MALE_01_Gloves_2_2_Right`

### 5.2 Presets female

#### Ib_FEMALE_01

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`, `Ib_FEMALE_01_Female_Eyelashes`, **`Ib_FEMALE_01_Female_Bra`**
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_1_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_1_1`; Hat —
- Cara/audio: `Ib_FEMALE_01_Glasses_1_1`, `Ib_FEMALE_01_Headphones_1_1`; Mask —
- Vestimenta: `Ib_FEMALE_01_Torso_1_1`, `Ib_FEMALE_01_Pants_1_1`, `Ib_FEMALE_01_Shoes_1_1`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_1_1_Left` + `Ib_FEMALE_01_Gloves_1_1_Right`

#### Ib_FEMALE_02

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_2_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_2_1`; Hat —
- Cara/audio: `Ib_FEMALE_01_Glasses_2_1`, `Ib_FEMALE_01_Headphones_1_3`; Mask —
- Vestimenta: `Ib_FEMALE_01_Full_Body_1_1`; Torso/Pants/Shoes —
- Manos: `Ib_FEMALE_01_Gloves_2_1_Left` + `Ib_FEMALE_01_Gloves_2_1_Right`

#### Ib_FEMALE_03

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_3_1`
- Pelo/sombrero: Hair —; `Ib_FEMALE_01_Hat_1_1`
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_FEMALE_01_Full_Body_1_3`; Torso/Pants/Shoes —
- Manos: `Ib_FEMALE_01_Gloves_1_2_Left` + `Ib_FEMALE_01_Gloves_1_2_Right`

#### Ib_FEMALE_04

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_4_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_3_1`; Hat —
- Cara/audio: `Ib_FEMALE_01_Mask_1_1`; Glasses/Headphones —
- Vestimenta: `Ib_FEMALE_01_Torso_1_1`, `Ib_FEMALE_01_Pants_1_1`, `Ib_FEMALE_01_Shoes_1_1`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_2_2_Left` + `Ib_FEMALE_01_Gloves_2_2_Right`

#### Ib_FEMALE_05

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_5_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_1_2`; Hat —
- Cara/audio: `Ib_FEMALE_01_Mask_2_1`; Glasses/Headphones —
- Vestimenta: `Ib_FEMALE_01_Torso_2_1`, `Ib_FEMALE_01_Pants_2_1`, `Ib_FEMALE_01_Shoes_2_1`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_1_3_Left` + `Ib_FEMALE_01_Gloves_1_3_Right`

#### Ib_FEMALE_06

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_6_1`
- Pelo/sombrero: Hair —; `Ib_FEMALE_01_Hat_2_3`
- Cara/audio: `Ib_FEMALE_01_Glasses_2_2`; Mask/Headphones —
- Vestimenta: `Ib_FEMALE_01_Torso_3_3`, `Ib_FEMALE_01_Pants_3_3`, `Ib_FEMALE_01_Shoes_3_3`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_2_3_Left` + `Ib_FEMALE_01_Gloves_2_3_Right`

#### Ib_FEMALE_07

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_7_2`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_4_2`; Hat —
- Cara/audio: `Ib_FEMALE_01_Mask_2_3`, `Ib_FEMALE_01_Headphones_1_3`; Glasses —
- Vestimenta: `Ib_FEMALE_01_Torso_5_2`, `Ib_FEMALE_01_Pants_5_2`, `Ib_FEMALE_01_Shoes_6_1`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_1_1_Left` + `Ib_FEMALE_01_Gloves_1_1_Right`

#### Ib_FEMALE_08

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_8_1`
- Pelo/sombrero: Hair —; `Ib_FEMALE_01_Hat_3_3`
- Cara/audio: Glasses/Mask/Headphones —
- Vestimenta: `Ib_FEMALE_01_Torso_5_3`, `Ib_FEMALE_01_Pants_2_2`, `Ib_FEMALE_01_Shoes_5_2`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_1_3_Left` + `Ib_FEMALE_01_Gloves_1_3_Right`

#### Ib_FEMALE_09

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`, `Ib_FEMALE_01_Female_Eyelashes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_9_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_3_3`; Hat —
- Cara/audio: `Ib_FEMALE_01_Mask_2_3`; Glasses/Headphones —
- Vestimenta: `Ib_FEMALE_01_Torso_2_2`, `Ib_FEMALE_01_Pants_2_3`, `Ib_FEMALE_01_Shoes_3_3`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_2_1_Left` + `Ib_FEMALE_01_Gloves_2_1_Right`

#### Ib_FEMALE_10

- Anatomía: `Ib_FEMALE_01_Female_Head`, `Ib_FEMALE_01_Female_Eyes`
- Cejas: `Ib_FEMALE_01_Female_Eyebrows_10_1`
- Pelo/sombrero: `Ib_FEMALE_01_Hair_2_3`; Hat —
- Cara/audio: `Ib_FEMALE_01_Headphones_1_3`; Glasses/Mask —
- Vestimenta: `Ib_FEMALE_01_Torso_1_3`, `Ib_FEMALE_01_Pants_1_2`, `Ib_FEMALE_01_Shoes_1_2`; Fullbody —
- Manos: `Ib_FEMALE_01_Gloves_2_1_Left` + `Ib_FEMALE_01_Gloves_2_1_Right`

---

## 6. Reglas de compatibilidad y dependencias

### 6.1 Lo que el código realmente hace

`CharacterCustomizationManager`:

1. mantiene un array de categorías;
2. desactiva todos los modelos de todas las opciones;
3. guarda una sola opción seleccionada por categoría;
4. activa el modelo elegido en cada categoría.

No contiene:

- matriz de compatibilidad;
- exclusiones entre categorías;
- ocultación automática de body;
- tratamiento especial de Fullbody;
- pairing automático de guantes;
- regla Hair/Hat;
- lógica de materiales o colores.

La documentación PDF solo explica cómo crear categorías/opciones, arrastrar los modelos del prefab y ocultarlos inicialmente. Tampoco define compatibilidades.

### 6.2 Convenciones confirmadas por los presets

| Convención observada | Evidencia | Fuerza |
|---|---|---|
| Fullbody sustituye Torso + Pants + Shoes | Todos los presets con Fullbody —Male 01/02, Female 02/03— dejan esas tres categorías vacías. | Convención fuerte, no impuesta. |
| Los guantes se usan como pares iguales | Todos los presets con guantes activan Left y Right con el mismo diseño y colorway. | Convención fuerte, no impuesta. |
| Normalmente Hat sustituye Hair | Se cumple en la mayoría de presets con sombrero. | Convención general con una excepción. |
| Hair y Hat pueden coexistir | Male 07 activa `Hair_4_1` y `Hat_3_2`. | Excepción confirmada; no aplicar exclusión universal. |
| Fullbody permite accesorios superiores | Los presets con Fullbody conservan pelo/sombrero, cara, audio y guantes. | Confirmado por presets. |
| Glasses y Mask no aparecen juntos | Ningún preset los combina. | Solo observación; no demuestra incompatibilidad. |
| Hat y Headphones no aparecen juntos | Ningún preset los combina. | Solo observación; no demuestra incompatibilidad. |

### 6.3 Piezas anatómicas y visibilidad

- `Male_Body` y `Fem_Body` permanecen inactivos en los 20 presets. No se ha encontrado una regla documental que explique para qué combinación concreta se reservan.
- Head y Eyes suelen actuar como base, pero **no son universalmente obligatorios** en los datos:
  - Male 05, 08 y 09 omiten `Male_Eyes`.
  - Los 10 presets femeninos sí activan `Female_Eyes`.
- `Female_Eyelashes` solo se activa en Female 01 y 09.
- Female 01 activa simultáneamente `Female_Bra` y `Torso_1_1`. Es el único caso de bra base explícita bajo un torso.
- No hay evidencia de que una prenda ordene ocultar submeshes del cuerpo por software. Las combinaciones correctas dependen por completo de escoger la lista adecuada de meshes visibles.

### 6.4 Regla práctica que no debe extrapolarse

El personalizador masculino usa `Male_Hands`, un único mesh con ambas manos, como opción base tanto en “Hand Left” como en “Hand Right”. Esto significa que una combinación “mano izquierda desnuda + guante derecho” no puede representarse limpiamente con esa opción base: activar `Male_Hands` mostraría ambas manos, además del guante derecho. Firetoy evita el problema usando siempre pares de guantes.

En Female sí existen manos base separadas, por lo que técnicamente puede mezclarse una mano desnuda y otra enguantada; aun así, los presets tampoco lo hacen.

### 6.5 Compatibilidad male/female

Las piezas están skinneadas a esqueletos de nombres/topología equivalentes, pero sus meshes, proporciones, prendas, prefijos y catálogos son específicos de género. El pack no ofrece prefabs ni reglas para intercambiar piezas male/female. Deben considerarse catálogos separados salvo que se realice una validación visual y de skinning adicional fuera del alcance de este mapa.

---

## 7. Materiales, texturas y colores

### 7.1 Assets Unity

| Género | Material | GUID material | Textura | GUID textura |
|---|---|---|---|---|
| Male | `B_Material_M_01.mat` | `6ae3e6f82033cbb4484d5d3a18dac30f` | `B_Texture_M_01.png` | `31fa4e9ecadf3764399c4ed8b17505a9` |
| Female | `B_Material_F_01.mat` | `2bd0bf5e8883d2d49903a6f971273c32` | `B_Texture_F_01.png` | `4e069587dbd51554db2f4eca0aa6ff0d` |

Los dos materiales usan el shader Standard integrado de Unity, opaco:

- `_MainTex`: el atlas del género.
- `_Color`: blanco.
- Metallic: 0.
- Glossiness: 0.05.
- Sin normal map, emission map ni occlusion map.

### 7.2 Hallazgo importante: un atlas visual común

Los PNG `B_Texture_M_01.png` y `B_Texture_F_01.png`:

- miden 1024 × 1024;
- son RGB;
- tienen el mismo hash de contenido;
- coinciden también con la imagen PNG embebida en ambos GLB.

Por tanto, Unity presenta **dos assets/GUID distintos**, pero el contenido visual es exactamente el mismo atlas. Es una cuadrícula de parches de color sólido, utilizada como paleta mediante UV.

Resumen:

| Métrica | Male | Female |
|---|---:|---:|
| Materiales lógicos en Unity | 1 | 1 |
| Texturas nominales en Unity | 1 | 1 |
| Materiales en el GLB | 1 | 1 |
| Texturas/imágenes en el GLB | 1 | 1 |
| Contenido de imagen distinto entre géneros | No | No |

### 7.3 Colorways

La inspección de nombres, geometría, UV e iconos confirma que:

- `_1`, `_2` y `_3` son tres variantes de paleta/color del mismo diseño.
- En la gran mayoría de familias, la forma y los bounds son iguales y lo que cambia de manera funcional es el muestreo UV del atlas.
- No debe asumirse que los archivos sean siempre byte-idénticos: se detectaron pequeñas diferencias de topología/puntos en algunas familias femeninas, especialmente `Hair_2` y `Torso_3`, aunque conservan forma/bounds equivalentes.

Por seguridad, cada colorway debe tratarse como una pieza real independiente, tal como lo hace Firetoy.

### 7.4 Recolor en runtime

El pack **no implementa recoloreado runtime**. No hay código que cambie:

- propiedades de material;
- colores de vértice;
- texturas;
- offsets UV;
- palettes/masks.

Posibilidades técnicas futuras, no implementadas por Firetoy:

- Activar el mesh `_1`, `_2` o `_3` correspondiente.
- Clonar material y aplicar un tint global a una pieza, entendiendo que teñirá conjuntamente todos los colores muestreados.
- Construir un shader de paleta o sustituir atlas/UV para recolores más finos.

Advertencia: como todas las piezas de un GLB comparten el mismo material, mutarlo directamente puede recolorear múltiples piezas a la vez. Para cosméticos independientes harían falta instancias/clones o una estrategia propia.

---

## 8. Mapping Unity → GLB

### 8.1 Estadísticas de los GLB

| Dato | `firetoy-male.glb` | `firetoy-female.glb` |
|---|---:|---:|
| Tamaño | 12,132,224 bytes | 11,160,564 bytes |
| Nodos totales | 232 | 210 |
| Nodos mesh | 166 | 144 |
| Joints | 65 | 65 |
| Skins | 1 | 1 |
| Animations | 0 | 0 |
| Materials | 1 | 1 |
| Textures/images | 1 | 1 |
| Morph targets | 0 | 0 |
| Exportador | Khronos glTF Blender I/O v5.1.20 | Khronos glTF Blender I/O v5.1.20 |

Hashes SHA-256 de las copias inspeccionadas:

```text
firetoy-male.glb
a82e1e080ce8e40493f01c44c95be7886786416f0d381dd0d5b75cf664126fee

firetoy-female.glb
155c8731e1753f2bce832f394528ea904b46451ed02dc86f4419573d6f34a027
```

### 8.2 Correspondencia exacta

Se compararon:

- los stems de todos los archivos `Parts_Male/*.prefab`;
- los stems de todos los archivos `Parts_Female/*.prefab`;
- todos los nodos con mesh de cada GLB.

Resultado:

| Género | Prefabs de pieza | Nodos mesh GLB | Solo en Unity | Solo en GLB |
|---|---:|---:|---:|---:|
| Male | 166 | 166 | 0 | 0 |
| Female | 144 | 144 | 0 | 0 |

El mapping puede formarse sin tabla de alias:

```text
Parts_Male/Ib_MALE_01_Hat_2_3.prefab
→ FBX GameObject Ib_MALE_01_Hat_2_3
→ GLB node Ib_MALE_01_Hat_2_3

Parts_Female/Ib_FEMALE_01_Mask_2_3.prefab
→ FBX GameObject Ib_FEMALE_01_Mask_2_3
→ GLB node Ib_FEMALE_01_Mask_2_3
```

### 8.3 Qué nombres no se conservan

- El material fuente `B_Material_M_01` / `B_Material_F_01` aparece en los GLB como `Material.001`.
- Los recursos internos `mesh.name` del glTF tienen nombres genéricos de Blender como `Mesh.009`, `Plane.017`, `Cube.001` o `RetopoFlow.031`.
- Los GUID y fileID de Unity no sobreviven al formato glTF.
- Los objetos vacíos del personalizador —`Ib_*_Hats`, `Ib_*_Masks`, etc.— no están en los GLB.
- Los nombres/IDs de categorías del script y la composición de presets no están embebidos en los GLB.

**Identificador estable recomendado para la integración:** el nombre exacto del nodo skinned, no `mesh.name`, índice de nodo ni fileID.

### 8.4 Estado inicial del GLB

Los GLB contienen todas las variantes superpuestas. El archivo no conserva las banderas `m_IsActive` de un prefab concreto ni una selección por defecto. Una carga que renderice todos los nodos visibles mostrará el “armario completo” solapado.

El preset inicial debe definirse externamente a partir de una lista de nombres, y toda pieza no elegida debe quedar oculta. Esto describe la necesidad arquitectónica; este documento no aporta implementación.

### 8.5 Escala y bounds aproximados

| GLB | X | Y | Z |
|---|---|---|---|
| Male | −0.556 a 0.556 | −0.002 a 1.845 | −0.215 a 0.266 |
| Female | −0.564 a 0.564 | −0.003 a 2.054 | −0.294 a 0.311 |

Los bounds incluyen todas las piezas, incluidos sombreros altos; no equivalen a la talla visual de un preset normal.

---

## 9. Cómo organiza Firetoy el sistema modular

### 9.1 Prefabs de piezas

Cada prefab bajo `Parts_Male` o `Parts_Female` contiene:

- una copia del armature completo de 65 bones;
- un único `SkinnedMeshRenderer`;
- un Animator que referencia el avatar del FBX;
- ningún Animator Controller asignado.

No son accesorios rígidos acoplados a un socket. Incluso gafas, sombreros, máscaras y auriculares son meshes skinneados al esqueleto.

Para comprender el catálogo basta el prefab de pieza; para una integración web basada en los GLB combinados no conviene conceptualmente instanciar 166/144 armatures separados.

### 9.2 Prefabs completos del personalizador

`Ib_MALE.prefab` e `Ib_FEMALE.prefab` contienen:

- el modelo completo;
- objetos vacíos para las opciones “ninguna”;
- la lista serializada de categorías y opciones;
- referencias fileID a cada GameObject;
- `CharacterCustomizationManager`.

El manager genera nombres legibles sustituyendo `_` por espacios y carga los iconos desde `Resources/Sprites/<model.name>`.

### 9.3 Defaults y persistencia

Al iniciar, el manager:

1. escoge la primera opción de cada categoría como default;
2. desactiva todos los modelos;
3. activa los defaults.

Existe una llamada de guardado a `PlayerPrefs` al deshabilitar el componente, pero no se encontró una carga correspondiente en el flujo normal. Además, el estado se basa en un diccionario serializado con `JsonUtility`, combinación que debe considerarse dudosa en Unity. No debe tomarse esa persistencia como contrato para Aura Battle.

### 9.4 Asimetría de prefabs de preset

- Los presets masculinos están serializados como copias completas/desempaquetadas.
- Los femeninos están serializados principalmente como overrides `m_IsActive` sobre el FBX.

Esta diferencia de authoring no afecta al mapping final: las referencias femeninas se resolvieron mediante GUID/fileID y todos los identificadores de mesh correspondieron a nombres presentes en el GLB.

---

## 10. Accesorios interesantes para Aura Battle

Esta sección no diseña gameplay. Solo identifica familias visualmente apropiadas para recompensas/cosméticos. Los rótulos descriptivos son **interpretación visual**; el nombre técnico es el dato canónico.

### Gafas / sunglasses

- Male: `Ib_MALE_01_Glasses_1_1` … `Ib_MALE_01_Glasses_1_3`
- Male: `Ib_MALE_01_Glasses_2_1` … `Ib_MALE_01_Glasses_2_3`
- Female: `Ib_FEMALE_01_Glasses_1_1` … `Ib_FEMALE_01_Glasses_1_3`
- Female: `Ib_FEMALE_01_Glasses_2_1` … `Ib_FEMALE_01_Glasses_2_3`

`Glasses_1` tiene silueta cuadrada/tintada; `Glasses_2` es una montura/shade más agresiva.

### Cascos, gorros y cabezas de disfraz

- Casco deportivo male: `Ib_MALE_01_Hat_1_1`, `_1_2`, `_1_3`
- Casco táctico male: `Ib_MALE_01_Hat_2_1`, `_2_2`, `_2_3`
- Cabeza/bolsa male: `Ib_MALE_01_Hat_3_1`, `_3_2`, `_3_3`
- Beanie male: `Ib_MALE_01_Hat_4_1`, `_4_2`, `_4_3`
- Casco deportivo female: `Ib_FEMALE_01_Hat_1_1`, `_1_2`, `_1_3`
- Casco táctico female: `Ib_FEMALE_01_Hat_2_1`, `_2_2`, `_2_3`
- Cabeza de pollo grande female: `Ib_FEMALE_01_Hat_3_1`, `_3_2`, `_3_3`
- Gorro/cabeza de pollo female: `Ib_FEMALE_01_Hat_4_1`, `_4_2`, `_4_3`

### Headphones

- Male: `Ib_MALE_01_Headphones_1_{1..3}`
- Female: `Ib_FEMALE_01_Headphones_1_{1..3}`

### Masks

- Male: `Ib_MALE_01_Mask_1_{1..3}`, `Ib_MALE_01_Mask_2_{1..3}`
- Female: `Ib_FEMALE_01_Mask_1_{1..3}`, `Ib_FEMALE_01_Mask_2_{1..3}`

Visualmente, `Mask_1` es una familia de máscara/gas mask y `Mask_2` una familia más voluminosa. En Female, `Mask_2` tiene una silueta de máscara de conejo especialmente distintiva.

### Guantes

- Male: `Ib_MALE_01_Gloves_{1..2}_{1..3}_{Left|Right}`
- Female: `Ib_FEMALE_01_Gloves_{1..2}_{1..3}_{Left|Right}`

Deben ofertarse preferentemente como **pares**, manteniendo diseño y colorway iguales.

### Torso / chaquetas visuales

- Male: `Ib_MALE_01_Torso_{1..5}_{1..3}`
- Female: `Ib_FEMALE_01_Torso_{1..5}_{1..3}`

Varias siluetas parecen chaquetas, camisas o tops, pero la categoría técnica siempre es `Torso`.

### Calzado

- Male: `Ib_MALE_01_Shoes_{1..5}_{1..3}`
- Female: `Ib_FEMALE_01_Shoes_{1..6}_{1..3}`

Es una de las familias con más variedad visual, especialmente en Female.

### Full-body skins

- Male: `Ib_MALE_01_Full_Body_1_{1..3}`
- Female: `Ib_FEMALE_01_Full_Body_1_{1..3}`

Son candidatos naturales a recompensa de conjunto completo, pero deben sustituir simultáneamente Torso, Pants y Shoes.

### Barbas

- Exclusivas de Male: `Ib_MALE_01_Beard_{1..8}_{1..3}`

Hay 24 combinaciones técnicas. No existe equivalente femenino en el asset.

### Piezas solicitadas que no existen

- Chains/cadenas: ninguna.
- Accessories genéricos: ninguna categoría ni mesh con ese nombre.
- Jackets independientes: ninguna categoría; usar las variantes visuales de `Torso`.

---

## 11. Problemas y peculiaridades antes de programar

### Críticos

1. **Ocultar todo antes de aplicar una selección.** El GLB contiene todas las variantes superpuestas.
2. **Usar nombres de nodos, no nombres internos de mesh.**
3. **Conservar el punto final** de `Ib_MALE_01_Male_Eyebrows_10_1.`.
4. **Representar “ninguna” fuera del GLB.** Los dummies de Unity no se exportaron.
5. **Tratar Male y Female como catálogos separados.**
6. **Resolver Fullbody como exclusión de Torso/Pants/Shoes.** Es una convención inequívoca de todos los presets, aunque no exista código fuente que la imponga.
7. **Emparejar guantes.** Es el único comportamiento compatible de forma segura con las manos base masculinas.

### Importantes

8. No forzar una exclusión universal Hair/Hat: Male 07 demuestra una combinación válida.
9. No activar Eyes o Eyelashes por intuición al reproducir presets; respetar las listas exactas.
10. No activar `Male_Body`/`Fem_Body` por defecto sin validar visualmente: Firetoy no lo hace en ninguno de sus presets.
11. No asumir que los tres colorways pueden reducirse a un cambio de color hexadecimal: son meshes/UV reales y alguna familia tiene pequeñas diferencias geométricas.
12. No mutar el material GLB compartido esperando un efecto local.
13. No esperar clips de animación dentro de los GLB; solo contienen rig/skin.
14. No usar índices glTF como identificadores persistentes: el contrato estable observado es el nombre exacto del nodo.

### Pendientes que el asset no permite determinar con certeza

- Qué combinaciones Glasses + Mask son visualmente aceptables: no hay reglas ni presets que las prueben.
- Qué combinaciones Hat + Headphones son visualmente aceptables: tampoco están documentadas.
- Si `Male_Body`/`Fem_Body` fueron pensados para debugging, para una variante futura o para combinaciones no incluidas.
- Si las omisiones de `Male_Eyes` en los presets 05/08/09 son decisiones artísticas o descuidos. El dato seguro es que están inactivos.
- Una política general de oclusión de pelo por cada sombrero. Solo hay evidencia preset por preset.

---

## 12. Contrato de datos mínimo sugerido para la futura integración

Sin prescribir implementación, el mapa de datos que Claude construya debería poder expresar:

- género/catálogo;
- nombre exacto del nodo GLB;
- categoría técnica Firetoy;
- diseño;
- colorway;
- lado, cuando aplique;
- opción “ninguna” sin nodo;
- pares obligatorios de guantes;
- exclusión Fullbody ↔ Torso/Pants/Shoes;
- excepciones Hair + Hat permitidas;
- presets como listas explícitas de nodos activos;
- piezas anatómicas explícitas, sin defaults inferidos.

Este contrato preserva el comportamiento observable del asset y evita depender de GUID, fileID, orden de nodos o nombres de recursos internos de Blender.

---

## 13. Tabla rápida de totales

| Familia | Male | Female |
|---|---:|---:|
| Base/anatomía | 7 | 9 |
| Beard | 24 | 0 |
| Eyebrows | 33 | 33 |
| Glasses | 6 | 6 |
| Fullbody | 3 | 3 |
| Hair | 15 | 12 |
| Hats | 12 | 12 |
| Masks | 6 | 6 |
| Shoes | 15 | 18 |
| Gloves, meshes individuales | 12 | 12 |
| Headphones | 3 | 3 |
| Pants | 15 | 15 |
| Torso | 15 | 15 |
| **Total** | **166** | **144** |

---

## Conclusión

Firetoy construyó el pack como dos catálogos de `SkinnedMeshRenderer` sobre esqueletos equivalentes, con una selección por visibilidad y un atlas de paleta común. Los nombres de las piezas se preservaron íntegramente en los GLB, por lo que la integración puede basarse en un mapping directo por nombre de nodo.

La fidelidad no depende de resolver Unity en runtime: toda la información necesaria quedó reconstruida en este documento. Lo esencial es mantener las listas exactas, representar los “none” fuera del GLB y no añadir reglas de compatibilidad que el asset no demuestra.
