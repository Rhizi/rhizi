%.css: %.scss
	sass $< $@

CSS=res/client/css
SCSS=$(CSS)/style.scss $(wildcard $(CSS)/by-view/*.scss) $(wildcard $(CSS)/partials/*.scss) $(wildcard $(CSS)/modules/*.scss) $(wildcard $(CSS)/vendor/*.scss)

$(CSS)/style.css: $(SCSS)
