# 田园背景生成记录

2026-11-01，使用内置 imagegen 工具生成，未使用 CLI/API 回退。项目图片：`plugin/assets/meadow-wallpaper.png`。

最终提示词：

Use case: illustration-story. Asset type: production wallpaper for a calm Chinese desktop academic reading app named 奶蛙阅读器. Create one polished very wide landscape illustration, 2560x1440 composition. Quiet idyllic hand-painted storybook countryside with a mostly solid soft powder blue sky across the upper 65%, a few fluffy cream-white clouds at upper edges, gentle green meadow rolling across lower 35%. At the left and right edges and across the bottom meadow, include clearly identifiable charming small animals: a friendly little green frog (奶蛙), black-and-white cow, chestnut horse, orange cat, golden dog, fluffy sheep, white rabbit, and small birds. Animals should be distributed in natural small groupings, with space between, not all in a straight line, cute rounded expressive shapes and warm personality. Cohesive vegetation: grassy tufts, clover, daisies, tiny buttercups, a few rounded shrubs and leafy saplings framing the two lower corners, all belonging to the same meadow habitat. Low contrast but real visible color, sage grass, pale sky, warm cream accents. Main reading UI will overlay the CENTER upper 65%, so leave that area calm with no busy details; put the most recognizable animal faces at outer lower sides and lower quarter so they can remain visible around and through a translucent white panel. Beautiful subtle gouache texture, tidy editorial illustration, harmonious scale and lighting. Not a UI mockup. No text, no letters, no watermark, no frames.


## 角色修正

使用 `reading-frog.png` 作为角色身份参考，对背景进行内置 imagegen 编辑。最终角色为黄色奶蛙，保留梨形身体、浅色肚皮、绿眼圈、大眼睛、小嘴及绿色书本，移除误画的绿色青蛙。

最终编辑提示词：

Edit image 1 (the wide countryside wallpaper). Image 2 is the exact character identity reference for 奶蛙 (Naiwa): the yellow upright rounded pear-shaped creature, green-rimmed large eyes, tiny mouth, cream belly, short limbs, holding a green book. It is NOT a green frog. Replace ONLY the green frog sitting at the lower left near the orange cat with this recognizable yellow Naiwa character from image 2, sitting on the rock reading its green book. Make Naiwa about 1.5 times the size of the old green frog so its face and book are recognizable, but do not cover the cow or cat faces. Adapt its rendering gently to the wallpaper's gouache illustration while rigorously preserving its yellow body, pear-shaped upright silhouette, cream belly, big green-rimmed eyes and little mouth, green book. Keep the wide wallpaper composition, sky, clouds, cow, horse, cat, dog, sheep, rabbit, birds, trees, daisies, clover, meadow, lake and all other details unchanged. No green frog anywhere. No text, no watermark.
