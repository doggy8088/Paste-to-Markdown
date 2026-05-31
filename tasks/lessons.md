# Lessons

## 2026-05-31 social asset cropping
- Failure mode: A generated wide banner was resized with center-crop logic, which cut off the title.
- Detection signal: Visual inspection of `assets/readme-banner.png` showed the top of the title clipped.
- Prevention rule: For generated banners with important text, visually inspect the final resized asset and prefer contain/pad resizing over crop unless the safe area is proven.
- Tripwire: Run a final `view_image` check after any image resize that changes aspect ratio.
