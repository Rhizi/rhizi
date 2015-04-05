CSS=res/client/css
ROOT_SCSS=$(CSS)/style.scss
TARGET=$(CSS)/style.css
SCSS=$(ROOT_SCSS) $(wildcard $(CSS)/by-view/*.scss) $(wildcard $(CSS)/partials/*.scss) $(wildcard $(CSS)/modules/*.scss) $(wildcard $(CSS)/vendor/*.scss)

%.css: %.scss
	sass $< $@

all: css

css: $(TARGET)

force: touch css

touch:
	touch $(ROOT_SCSS)


$(CSS)/style.css: $(SCSS)
