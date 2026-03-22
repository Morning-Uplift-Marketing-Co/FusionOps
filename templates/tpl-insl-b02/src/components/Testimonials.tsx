import { useState } from 'react';

const testimonials = [
  {
    name: "Sarah M.",
    location: "Austin, TX",
    pet: "Golden Retriever - Max",
    rating: 5,
    text: "When Max needed emergency surgery, I was panicking about the cost. TPL-USA-B02 approved me in minutes and I could focus on my boy's recovery instead of worrying about money. The monthly payments are so manageable!",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop"
  },
  {
    name: "Michael R.",
    location: "Seattle, WA",
    pet: "Maine Coon - Luna",
    rating: 5,
    text: "I've used credit cards for vet bills before and the interest was crushing. TPL-USA-B02's rates are so much better and the process was incredibly easy. Luna got the dental work she needed and I'm not drowning in debt.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop"
  },
  {
    name: "Jennifer K.",
    location: "Miami, FL",
    pet: "Rescue Mix - Charlie",
    rating: 5,
    text: "As a single mom, unexpected vet bills can be really stressful. TPL-USA-B02 made it possible for Charlie to get the treatment he needed without breaking our budget. The customer service team was so understanding and helpful!",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop"
  },
  {
    name: "David L.",
    location: "Denver, CO",
    pet: "German Shepherd - Bella",
    rating: 5,
    text: "I was skeptical about pet financing, but TPL-USA-B02 changed my mind. No hidden fees, transparent terms, and approval was instant. Bella's hip surgery would have been impossible to afford otherwise. Thank you!",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop"
  },
  {
    name: "Amanda T.",
    location: "Boston, MA",
    pet: "French Bulldog - Duke",
    rating: 5,
    text: "The soft credit check was a game-changer. I could see my options without worrying about my credit score. Duke needed allergy treatments and TPL-USA-B02 made it happen. Highly recommend!",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop"
  },
  {
    name: "Robert P.",
    location: "Portland, OR",
    pet: "Siamese Cat - Mittens",
    rating: 5,
    text: "I've recommended TPL-USA-B02 to all my pet owner friends. When Mittens needed specialized care, they worked with my budget and found a payment plan that worked perfectly. Professional and compassionate service.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop"
  }
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/20">
            Testimonials
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            What Pet Parents Say
          </h2>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Join thousands of happy customers who chose TPL-USA-B02 for their pet care financing
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Main Testimonial Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
              <img
                src={testimonials[currentIndex].image}
                alt={testimonials[currentIndex].name}
                className="w-20 h-20 rounded-full object-cover"
              />
              <div className="text-center md:text-left flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {testimonials[currentIndex].name}
                </h3>
                <p className="text-gray-600 mb-2">{testimonials[currentIndex].location}</p>
                <p className="text-blue-600 font-semibold">{testimonials[currentIndex].pet}</p>
                <div className="flex justify-center md:justify-start mt-2">
                  {[...Array(testimonials[currentIndex].rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>

            <blockquote className="text-gray-700 text-lg leading-relaxed italic">
              "{testimonials[currentIndex].text}"
            </blockquote>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center mt-8 gap-4">
            <button
              onClick={prevTestimonial}
              className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg border border-white/20"
              aria-label="Previous testimonial"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToTestimonial(index)}
                  className={`h-3 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white w-8'
                      : 'bg-blue-300 hover:bg-blue-200 w-3'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={nextTestimonial}
              className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-colors shadow-lg border border-white/20"
              aria-label="Next testimonial"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          <div className="text-center text-white bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
            <div className="text-4xl font-bold mb-2">50,000+</div>
            <div className="text-blue-200">Happy Customers</div>
          </div>
          <div className="text-center text-white bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
            <div className="text-4xl font-bold mb-2">4.9/5</div>
            <div className="text-blue-200">Average Rating</div>
          </div>
          <div className="text-center text-white bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
            <div className="text-4xl font-bold mb-2">98%</div>
            <div className="text-blue-200">Approval Rate</div>
          </div>
          <div className="text-center text-white bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
            <div className="text-4xl font-bold mb-2">24/7</div>
            <div className="text-blue-200">Support Available</div>
          </div>
        </div>
      </div>
    </section>
  );
}
