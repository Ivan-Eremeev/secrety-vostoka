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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzY3JpcHRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uICgpIHtcclxuXHQvLyBDQVJPVVNFTC0xXHJcblx0dmFyIG93bCA9ICQoJyNjYXJvdXNlbCcpLm93bENhcm91c2VsKHtcclxuXHRcdGl0ZW1zOiAxLFxyXG5cdFx0bmF2OiBmYWxzZSxcclxuXHRcdGRvdHM6IHRydWUsXHJcblx0XHRsb29wOiB0cnVlXHJcblx0fSk7XHJcblx0Ly8gR28gdG8gdGhlIG5leHQgaXRlbVxyXG5cdCQoJy5jdXN0b21OZXh0QnRuJykuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0ICAgIG93bC50cmlnZ2VyKCduZXh0Lm93bC5jYXJvdXNlbCcpO1xyXG5cdH0pXHJcblx0Ly8gR28gdG8gdGhlIHByZXZpb3VzIGl0ZW1cclxuXHQkKCcuY3VzdG9tUHJldkJ0bicpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG5cdCAgICBvd2wudHJpZ2dlcigncHJldi5vd2wuY2Fyb3VzZWwnKTtcclxuXHR9KVxyXG5cclxuXHQvLyBDQVJPVVNFTC0yXHJcblx0dmFyIG93bDIgPSAkKCcjY2Fyb3VzZWwtMicpLm93bENhcm91c2VsKHtcclxuXHRcdGl0ZW1zOiAxLFxyXG5cdFx0bmF2OiBmYWxzZSxcclxuXHRcdGRvdHM6IGZhbHNlLFxyXG5cdFx0bG9vcDogdHJ1ZVxyXG5cdH0pO1xyXG5cdC8vIEdvIHRvIHRoZSBuZXh0IGl0ZW1cclxuXHQkKCcuY3VzdG9tTmV4dEJ0bjInKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHQgICAgb3dsMi50cmlnZ2VyKCduZXh0Lm93bC5jYXJvdXNlbCcpO1xyXG5cdH0pXHJcblx0Ly8gR28gdG8gdGhlIHByZXZpb3VzIGl0ZW1cclxuXHQkKCcuY3VzdG9tUHJldkJ0bjInKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHQgICAgb3dsMi50cmlnZ2VyKCdwcmV2Lm93bC5jYXJvdXNlbCcpO1xyXG5cdH0pXHJcblxyXG5cdC8vIElOUFVUIE5VTUJFUlxyXG5cdHZhciBpbnB1dENvbnQxID0gJCgnLnByb2R1Y3RfaW5wLTEnKTtcclxuXHR2YXIgaW5wdXQxID0gaW5wdXRDb250MS5maW5kKCdpbnB1dCcpO1xyXG5cdHZhciBpbnB1dFZhbDEgPSBOdW1iZXIoaW5wdXQxLnZhbCgpKTtcclxuXHQkKFwiLnByb2R1Y3RfYXJyb3ctLXRvcC0xXCIpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG5cdFx0aW5wdXRWYWwxKys7XHJcblx0XHRpbnB1dDEudmFsKGlucHV0VmFsMSk7XHJcblx0fSk7XHJcblx0JChcIi5wcm9kdWN0X2Fycm93LS1ib3R0b20tMVwiKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHRcdGlucHV0VmFsMS0tO1xyXG5cdFx0aW5wdXQxLnZhbChpbnB1dFZhbDEpO1xyXG5cdH0pO1xyXG5cclxuXHR2YXIgaW5wdXRDb250MiA9ICQoJy5wcm9kdWN0X2lucC0yJyk7XHJcblx0dmFyIGlucHV0MiA9IGlucHV0Q29udDIuZmluZCgnaW5wdXQnKTtcclxuXHR2YXIgaW5wdXRWYWwyID0gTnVtYmVyKGlucHV0Mi52YWwoKSk7XHJcblx0JChcIi5wcm9kdWN0X2Fycm93LS10b3AtMlwiKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHRcdGlucHV0VmFsMisrO1xyXG5cdFx0aW5wdXQyLnZhbChpbnB1dFZhbDIpO1xyXG5cdH0pO1xyXG5cdCQoXCIucHJvZHVjdF9hcnJvdy0tYm90dG9tLTJcIikuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRpbnB1dFZhbDItLTtcclxuXHRcdGlucHV0Mi52YWwoaW5wdXRWYWwyKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gTUFUQ0hIRUlHSFRcclxuXHQkKCcucHJvZHVjdCcpLm1hdGNoSGVpZ2h0KCk7XHJcblx0JCgnLnByb2R1Y3RfY29sLS0xJykubWF0Y2hIZWlnaHQoKTtcclxuXHJcblx0Ly8gU0lERUJBUiBDQVRBTE9HXHJcblx0JCgnLnNpZGViYXJfbGluaycpLmNsaWNrKGZ1bmN0aW9uKCkge1xyXG5cdFx0aWYod2luZG93Lm1hdGNoTWVkaWEoJyhtYXgtd2lkdGg6IDk5MnB4KScpLm1hdGNoZXMpIHtcclxuXHRcdFx0JCgnI3NpZGViYXItY2hlY2tib3gnKS5wcm9wKHtjaGVja2VkOiB0cnVlfSk7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdC8vIE1FTlVcclxuXHQkKCcubWVudV9pdGVtJykuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRpZih3aW5kb3cubWF0Y2hNZWRpYSgnKG1heC13aWR0aDogNTc1cHgpJykubWF0Y2hlcykge1xyXG5cdFx0XHQkKCcjbWVudS1jaGVja2JveCcpLnByb3Aoe2NoZWNrZWQ6IHRydWV9KTtcclxuXHRcdH1cclxuXHR9KTtcclxuXHJcblx0Ly8gUE9QVVBcclxuXHR2YXIgcG9wdXAgPSAkKCcucG9wdXAnKVxyXG5cdCQoJy5zZWFyY2hfYnRuJykuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRwb3B1cC5mYWRlVG9nZ2xlKDApO1xyXG5cdH0pO1xyXG5cdCQoJy5zZWFyY2hfYnRuLS1tb2JpbGUnKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHRcdHBvcHVwLmZhZGVUb2dnbGUoMCk7XHJcblx0fSk7XHJcblx0JCgnLnBvcHVwX2Nsb3NlJykuY2xpY2soZnVuY3Rpb24oKSB7XHJcblx0XHRwb3B1cC5mYWRlT3V0KDApO1xyXG5cdH0pO1xyXG5cdCQoJy5wb3B1cF9idG4nKS5jbGljayhmdW5jdGlvbigpIHtcclxuXHRcdHBvcHVwLmZhZGVPdXQoMCk7XHJcblx0fSk7XHJcblxyXG59KSJdLCJmaWxlIjoic2NyaXB0cy5qcyJ9
