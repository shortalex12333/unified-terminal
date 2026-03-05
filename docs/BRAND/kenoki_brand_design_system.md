Kenoki Colour Specification Guide
1. Brand Philosophy

Kenoki’s palette is designed to feel creative, calm, and human, avoiding the cold blue aesthetic common in developer tools. The brand centers around soft pastel gradients supported by neutral surfaces and a single accent blue used strictly for interaction.

The goal is a balance between:

Creative tooling (warm pastels)

Technical clarity (clean neutrals)

Accessibility (clear contrast in both light and dark modes)

2. Primary Brand Gradient

This is the core Kenoki identity and should be used for:

Logo

Hero elements

Marketing materials

Occasional UI highlight accents

Gradient
#C7A6D8 → #D9A6C7 → #EAA7B6 → #F1A8A6

Recommended direction:

linear-gradient(135deg, #C7A6D8, #D9A6C7, #EAA7B6, #F1A8A6)

Color breakdown:

Color	Description
#C7A6D8	Soft lavender
#D9A6C7	Mauve
#EAA7B6	Dusty rose
#F1A8A6	Warm peach

Usage guidelines:

Use primarily for:

Logo

Large branding surfaces

Hero text

Avoid:

Small UI elements

Body text

Buttons

3. Accent Colour (Interaction)

Kenoki uses a single accent blue for interactive elements.

Accent Blue: #ACCBEE

Usage:

Links

Focus states

Selection highlights

Active states

Toggle indicators

Avoid using accent blue for:

Large backgrounds

Cards

Sections

Brand elements

The gradient defines the brand, not the blue.

4. Light Mode Colours
Background
#FAFAFA
Surface
#F4F4F4
Alternate Surface
#F0F0F8
Soft Panels
#FFFFFF
Borders
#E4E4E7
Text

Primary text

#1D1D1F

Secondary text

#4A4A4F

Muted text

#8A8A93
5. Dark Mode Colours

Dark mode uses soft charcoal tones, not pure black.

Primary Background
#1D1D1F
Secondary Background
#232327
Surface
#2B2B30
Border / Divider
#3A3A40
Text

Primary

#F4F4F4

Secondary

#CFCFD6

Muted

#9A9AA3
6. Glass / Overlay Surfaces

Kenoki supports subtle glass-style overlays for modals and floating panels.

Light mode glass
rgba(255,255,255,0.65)
Dark mode glass
rgba(30,30,34,0.65)

Recommended blur:

backdrop-filter: blur(12px)
7. Button Colours
Primary Button

Background

#ACCBEE

Text

#1D1D1F

Hover

#9FC2EA
Secondary Button

Background

transparent

Border

#ACCBEE

Text

#ACCBEE
8. Semantic States
Success
#7ED9B5
Warning
#F6C177
Error
#F08A8A
9. Radius System

Kenoki UI favors pill-shaped elements and soft curves.

Small radius: 8px
Medium radius: 14px
Large radius: 22px
Pill radius: 999px

Use pill radius for:

buttons

tags

chips

inputs

10. Shadow System

Light mode shadow

0px 8px 20px rgba(0,0,0,0.06)

Dark mode shadow

0px 10px 30px rgba(0,0,0,0.35)
11. Colour Hierarchy

Priority order:

Pastel gradient (brand identity)

Neutral surfaces

Accent blue (interaction only)

Semantic colours (feedback states)

This hierarchy ensures the interface stays calm, readable, and visually consistent.