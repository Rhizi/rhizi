%.css: %.scss
	sass $< $@

res/css/style.css: ./res/css/style.scss ./res/css/modules/positions.scss ./res/css/modules/colors.scss ./res/css/modules/typography.scss ./res/css/modules/mixins.scss ./res/css/partials/input-bar.scss ./res/css/partials/reset.scss ./res/css/partials/input-bubble.scss ./res/css/partials/top-bar.scss ./res/css/partials/metro-view.scss ./res/css/partials/graph-view.scss ./res/css/partials/info-box.scss ./res/css/partials/base.scss ./res/css/partials/search-bar.scss ./res/css/partials/grid.scss ./res/css/partials/dev-area.scss ./res/css/partials/typography.scss ./res/css/partials/buttons.scss ./res/css/partials/task-alert.scss
