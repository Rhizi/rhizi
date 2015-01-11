%.css: %.scss
	sass $< $@

CSS=res/client/css

$(CSS)/style.css: $(CSS)/style.scss $(CSS)/modules/positions.scss $(CSS)/modules/colors.scss $(CSS)/modules/typography.scss $(CSS)/modules/mixins.scss $(CSS)/partials/input-bar.scss $(CSS)/partials/reset.scss $(CSS)/partials/input-bubble.scss $(CSS)/partials/top-bar.scss $(CSS)/partials/metro-view.scss $(CSS)/partials/graph-view.scss $(CSS)/partials/info-card.scss $(CSS)/partials/base.scss $(CSS)/partials/search-bar.scss $(CSS)/partials/grid.scss $(CSS)/partials/dev-area.scss $(CSS)/partials/typography.scss $(CSS)/partials/buttons.scss $(CSS)/partials/task-alert.scss
