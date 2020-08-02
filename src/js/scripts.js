$(document).ready(function () {
	// CAROUSEL-1
	var owl = $('#carousel').owlCarousel({
		items: 1,
		nav: false,
		dots: true,
		loop: true
	});
	// Go to the next item
	$('.customNextBtn').click(function() {
	    owl.trigger('next.owl.carousel');
	})
	// Go to the previous item
	$('.customPrevBtn').click(function() {
	    owl.trigger('prev.owl.carousel');
	})

	// CAROUSEL-2
	var owl2 = $('#carousel-2').owlCarousel({
		items: 1,
		nav: false,
		dots: false,
		loop: true
	});
	// Go to the next item
	$('.customNextBtn2').click(function() {
	    owl2.trigger('next.owl.carousel');
	})
	// Go to the previous item
	$('.customPrevBtn2').click(function() {
	    owl2.trigger('prev.owl.carousel');
	})

	// INPUT NUMBER
	var inputCont1 = $('.product_inp-1');
	var input1 = inputCont1.find('input');
	var inputVal1 = Number(input1.val());
	$(".product_arrow--top-1").click(function() {
		inputVal1++;
		input1.val(inputVal1);
	});
	$(".product_arrow--bottom-1").click(function() {
		inputVal1--;
		input1.val(inputVal1);
	});

	var inputCont2 = $('.product_inp-2');
	var input2 = inputCont2.find('input');
	var inputVal2 = Number(input2.val());
	$(".product_arrow--top-2").click(function() {
		inputVal2++;
		input2.val(inputVal2);
	});
	$(".product_arrow--bottom-2").click(function() {
		inputVal2--;
		input2.val(inputVal2);
	});

	// MATCHHEIGHT
	$('.product').matchHeight();
	$('.product_col--1').matchHeight();

	// SIDEBAR CATALOG
	$('.sidebar_link').click(function() {
		if(window.matchMedia('(max-width: 992px)').matches) {
			$('#sidebar-checkbox').prop({checked: true});
		}
	});

	// MENU
	$('.menu_item').click(function() {
		if(window.matchMedia('(max-width: 575px)').matches) {
			$('#menu-checkbox').prop({checked: true});
		}
	});

	// POPUP
	var popup = $('.popup')
	$('.search_btn').click(function() {
		popup.fadeToggle(0);
	});
	$('.search_btn--mobile').click(function() {
		popup.fadeToggle(0);
	});
	$('.popup_close').click(function() {
		popup.fadeOut(0);
	});
	$('.popup_btn').click(function() {
		popup.fadeOut(0);
	});

})