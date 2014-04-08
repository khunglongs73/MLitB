var mlitb=mlitb||{REVISION:"ALPHA"};(function(a){a.W=[]})(mlitb);(function(c){var n=function(r){var q=[];if(typeof r[0].length==="undefined"&&typeof r.length==="number"){for(var t=0;t<r.length;t++){q[t]=r[t]}return q}else{if(typeof r[0].length==="number"){for(var t=0;t<r.length;t++){q[t]=[];for(var s=0;s<r[0].length;s++){q[t][s]=r[t][s]}}return q}}};var m=function(t,s){var r=[];for(var q=0;q<t;q++){r[q]=s()}return r};var e=function(q,w,t){var v=typeof w=="number"?t:w;var u={};if(typeof v==="undefined"||v==="zero"){u=function(){return 0}}else{if(v==="random"){u=function(){return Math.random()}}}if(typeof w==="number"){var s=[];for(var r=0;r<q;r++){s[r]=m(w,u)}return s}else{return m(q,u)}};var o=function(r,w){if(typeof r==="object"&&typeof w==="object"){var q=p(r);var v=p(w);if(q[0]===v[0]&&q[1]===v[1]){var u=[];for(var t=0;t<q[0];t++){u[t]=[];for(var s=0;s<q[1];s++){u[t][s]=r[t][s]+w[t][s]}}return u}else{console.log("ERROR!! matrix dimension does not match")}}else{if(typeof r==="object"&&typeof w==="number"){var q=p(r);var u=[];for(var t=0;t<q[0];t++){u[t]=[];for(var s=0;s<q[1];s++){u[t][s]=r[t][s]+w}}return u}}};var a=function(H,G,v){if(typeof H==="number"&&typeof G==="number"){return H*G}else{if(typeof H==="object"&&typeof G==="number"){var H=typeof H[0].length=="undefined"?[H]:H;var C=[];for(var A=0;A<H.length;A++){C[A]=[];for(var z=0;z<H[0].length;z++){C[A][z]=H[A][z]*G}}return C}else{var H=typeof H[0].length=="undefined"?[H]:H;var G=typeof G[0].length=="undefined"?[G]:G;var F=p(H);var E=p(G);if(typeof v==="undefined"&&F[1]!==E[0]){console.log("ERROR!! matrix dimension does not match")}else{if(v==="r"&&F[1]!==E[1]){console.log("ERROR!! matrix dimension does not match")}else{if(v==="l"&&F[0]!==E[0]){console.log("ERROR!! matrix dimension does not match")}else{var I=[];var u=v==="l"?F[1]:F[0];var t=v==="r"?E[0]:E[1];var s=v==="l"?F[0]:F[1];if(typeof v==="undefined"){var D=function(K,r,L,J,q){return K[L][q]*r[q][J]}}else{if(v==="r"){var D=function(K,r,L,J,q){return K[L][q]*r[J][q]}}else{if(v==="l"){var D=function(K,r,L,J,q){return K[q][L]*r[q][J]}}}}for(var A=0;A<u;A++){I[A]=[];for(var z=0;z<t;z++){var B=0;for(var w=0;w<s;w++){B+=D(H,G,A,z,w)}I[A][z]=B}}return I.length===1?I[0]:I}}}}}};var p=function(q){var q=typeof q[0].length=="undefined"?[q]:q;return[q.length,q[0].length]};var h=function(s,w,v){var r=Math.max.apply(null,s);var u=Math.min.apply(null,s);var q=[];for(var t=0;t<s.length;t++){q.push((s[t]-u)/(r-u)*(v-w)+w)}return q};var f=function(){};var l=false;var d=0;var k=function(){if(l){l=false;return d}var s=2*Math.random()-1;var q=2*Math.random()-1;var t=s*s+q*q;if(t==0||t>1){return k()}var w=Math.sqrt(-2*Math.log(t)/t);d=q*w;l=true;return s*w};var j=function(r,q){return Math.random()*(q-r)+r};var g=function(r,q){return Math.floor(Math.random()*(q-r)+r)};var b=function(r,q){return r+k()*q};c.zeros=e;c.dot=a;c.add=o;c.normalize=h;c.clone=n;c.randf=j;c.randi=g;c.randn=b})(mlitb);(function(b){var a=function(k,g,f,j){this.sx=k;this.sy=g;this.depth=f;var h=k*g*f;this.data=b.zeros(h);this.drv=b.zeros(h);if(typeof j==="number"){for(var d=0;d<h;d++){this.data[d]=j}}else{var e=Math.sqrt(1/(k*g*f));for(var d=0;d<h;d++){this.data[d]=b.randn(0,e)}}};a.prototype={get:function(e,h,g,f){var c=((this.sx*h)+e)+this.sx*this.sy*g;if(typeof f==="undefined"||f==="data"){return this.data[c]}else{if(f==="drv"){return this.drv[c]}}},set:function(e,j,h,f,g){var c=((this.sx*j)+e)+this.sx*this.sy*h;if(typeof g==="undefined"||g==="data"){this.data[c]=f}else{if(g==="drv"){this.drv[c]=f}}},cloneAndZeros:function(){return new a(this.sx,this.sy,this.depth,0)},clone:function(){var c=new a(this.sx,this.sy,this.depth,0);for(var d=0;d<this.data.length;d++){c.data[d]=this.data[d]}return c},getIndex:function(c,f,e){return((this.sx*f)+c)+this.sx*this.sy*e}};b.Vol=a})(mlitb);(function(b){var a=b.Vol;var c=function(d){this.sx=d.sx;this.in_sx=d.in_sx;this.in_sy=d.in_sy;this.in_depth=d.depth;this.sy=typeof d.sy!=="undefined"?d.sy:d.sx;this.stride=(typeof d.stride!=="undefined"&&d.stride<=Math.min(this.sx,this.sy))?d.stride:1;this.out_depth=d.filters;this.out_sx=Math.floor(d.in_sx/this.stride);this.out_sy=Math.floor(d.in_sy/this.stride);this.filters=[];for(var e=0;e<d.filters;e++){this.filters.push(new a(this.sx,this.sy,this.in_depth))}this.biases=new b.Vol(1,1,this.out_depth,1);this.conv_type=typeof d.conv_type!=="undefined"?d.conv_type:"same";this.layer_type="conv"};c.prototype={forward:function(h,n){this.V_in=h;var H=Math.floor(this.sx/2);var H=Math.floor(this.sy/2);var G=h.data;var z=new b.Vol(this.out_sx,this.out_sy,this.out_depth,0);var I=z.data;var o=this.filters;var E=this.biases;var t=0;var w=this.sx;var u=this.sy;for(var C=0;C<this.out_depth;C++){var p=o[i].data;var F=C*this.out_sx*this.out_sy;for(var B=0;B<this.in_depth;B++){for(var l=0,r=0;l<this.out_y;l++,r+=this.stride){for(var m=0,s=0;m<this.out_x;m++,s+=this.stride){var J=0;var k=B*w*u;for(var e=r,d=0;e<u+r;d++,e++){for(var g=s,D=0;g<w+s;D++,g++,k++){var j=e-hy;var f=g-H;var q=0;if(j>=0&&f>=0&&j<this.in_sx&&f<this.in_sy){q=h.get(j,f,B)}J+=q*p[k]}}I[F]+=J;F++}}F=C*this.out_sx*this.out_sy}}this.V_out=Out;return this.V_out},backward:function(){}};b.ConvLayer=c})(mlitb);(function(b){var a=b.Vol;var c=function(d){this.in_neurons=d.in_neurons;this.out_depth=d.n_neurons;this.out_sx=1;this.out_sy=1;this.weights=new b.Vol(1,this.in_neurons,this.out_depth);this.biases=new b.Vol(1,1,this.out_depth,1);this.layer_type="fc"};c.prototype={forward:function(f,t){this.V_in=f;var q=f.data;var k=new b.Vol(1,1,this.out_depth);var l=k.data;var r=this.weights.data;var o=this.biases;var s=0;for(var h=0,e=this.out_depth;h<e;h++){var p=0;for(var g=0,d=this.in_neurons;g<d;g++,s++){p+=q[g]*r[s]}p+=o.data[h];l[h]=p}this.V_out=k;return this.V_out},backward:function(){var q=this.V_in.drv;var l=this.weights.data;var d=this.weights.drv;var r=this.biases.drv;var k=this.V_in.data;var o=0;for(var h=0,f=this.out_depth;h<f;h++){var p=this.V_out.drv[h];for(var g=0,e=this.in_neurons;g<e;g++,o++){q[g]+=p*l[o];d[o]+=p*k[g]}r[h]+=p}}};b.FullConnLayer=c})(mlitb);(function(f){var a=f.Vol;var c={sigmoid:function(j){return 1/(1+Math.exp(-j))},sigmoid_bipolar:function(j){return -1+2/(1+Math.exp(-j))},linear:function(j){return j}};var h={sigmoid:function(j){return(1/(1+Math.exp(-j)))*(1-1/(1+Math.exp(-j)))},sigmoid_bipolar:function(j){return 0.5*(1+(-1+2/(1+Math.exp(-j))))*(1-(-1+2/(1+Math.exp(-j))))},linear:function(j){return 1}};var g=function(j){this.out_sx=j.out_sx;this.out_sy=j.out_sy;this.out_depth=j.out_depth;this.layer_type="sigmoid"};g.prototype={forward:function(j,m){this.V_in=j;var l=j.cloneAndZeros();var n=j.data.length;for(var k=0;k<n;k++){l.data[k]=1/(1+Math.exp(-j.data[k]))}this.V_out=l;return this.V_out},backward:function(j){var o=this.V_out.data;var p=f.zeros(m);var m=this.V_in.data.length;if(typeof j==="undefined"){var k=this.V_out.drv;for(var l=0;l<m;l++){var n=o[l];p[l]=n*(1-n)*k[l]}this.V_in.drv=p}else{j=typeof j==="number"?[j]:j;var r=0;for(var l=0;l<m;l++){var n=o[l];var q=n-j[l];p[l]=n*(1-n)*q;r+=(q*q)/2}this.V_in.drv=p;return r}}};var d=function(j){this.out_sx=j.out_sx;this.out_sy=j.out_sy;this.out_depth=j.out_depth;this.layer_type="relu"};d.prototype={forward:function(k,o){this.V_in=k;var n=k.clone();var m=n.data;var j=k.data;var p=k.data.length;for(var l=0;l<p;l++){if(j[l]<=0){m[l]=0}}this.V_out=n;return this.V_out},backward:function(o){var m=this.V_out.drv;var k=this.V_out_data;var n=V_in.data.length;var l=f.zeros(n);for(var j=0;j<n;j++){if(k[j]<=0){l[j]=0}else{l[j]=m[j]}}this.V_in.drv=l}};var e=function(j){var j=j||{};this.num_inputs=j.in_sx*j.in_sy*j.in_depth;this.out_depth=this.num_inputs;this.out_sx=1;this.out_sy=1;this.layer_type="softmax"};e.prototype={forward:function(k,q){this.V_in=k;var p=new a(1,1,this.out_depth,0);var j=k.data;var o=k.data[0];for(var l=1;l<this.out_depth;l++){if(j[l]>o){o=j[l]}}var m=f.zeros(this.out_depth);var n=0;for(var l=0;l<this.out_depth;l++){m[l]=Math.exp(j[l]-o);n+=m[l]}for(var l=0;l<this.out_depth;l++){m[l]/=n}p.data=m;this.Z_data=m;this.V_out=p;return this.V_out},backward:function(l){V_in_drv=f.zeros(this.V_in.data.length);for(var k=0;k<this.out_depth;k++){var j=k===l?1:0;V_in_drv[k]=-(j-this.Z_data[k])}this.V_in.drv=V_in_drv;return -Math.log(this.V_out.data[l])}};var b=function(j){this.out_sx=j.out_sx;this.out_sy=j.out_sy;this.out_depth=j.out_depth;this.layer_type="linear"};b.prototype={forward:function(j,l){this.V_in=j;var k=j.clone();this.V_out=k;return this.V_out},backward:function(p){var k=this.V_out.data;var n=f.zeros(o);var o=this.V_in.data.length;p=typeof p==="number"?[p]:p;var m=0;for(var j=0;j<o;j++){var l=k[j]-p[j];n[j]=l;m+=(l*l)/2}this.V_in.drv=n;return m}};f.LinearLayer=b;f.SoftmaxLayer=e;f.ReLuLayer=d;f.SigmoidLayer=g;f.fw_fn=c;f.bw_fn=h})(mlitb);(function(c){var a=c.Vol;var b=function(d){var d=d||{};this.sx=d.sx;this.in_depth=d.in_depth;this.in_sx=d.in_sx;this.in_sy=d.in_sy;this.sy=typeof d.sy!=="undefined"?d.sy:this.sx;this.stride=(typeof d.stride!=="undefined"&&d.stride<=this.sx)?d.stride:this.sx;this.ignore_border=typeof d.ignore_border!=="undefined"?d.ignore_border:false;this.pool_type=typeof d.pool_type!=="undefined"?d.pool_type:"max";this.out_depth=this.in_depth;this.out_sx=Math.floor(this.in_sx/this.stride);this.out_sy=Math.floor(this.in_sy/this.stride);this.max_pos_x=c.zeros(this.out_sx*this.out_sy*this.out_depth);this.max_pos_y=c.zeros(this.out_sx*this.out_sy*this.out_depth);this.layer_type="pool"};b.prototype={forward:function(h,l){this.V_in=h;var e=new a(this.out_sx,this.out_sy,this.out_depth,0);var t=this.max_pos_x;var s=this.max_pos_y;var o=e.data;var z=Math.floor(this.sx/2);var u=Math.floor(this.sy/2);var r=0;for(var A=0;A<this.out_depth;A++){for(var p=0,j=0;j<this.out_sy;p+=this.stride,j++){for(var q=0,k=0;k<this.out_sx;q+=this.stride,k++,r++){var C=-99999999;var B=-1;var w=-1;for(var f=p;f<this.sy+p;f++){for(var g=q;g<this.sx+q;g++){var m=-999999999;if(g<this.in_sx&&f<this.in_sy){m=h.get(g,f,A)}if(m>C){C=m;B=g;w=f}}}e.set(k,j,A,C);t[r]=B;s[r]=w}}}this.V_out=e;return this.V_out},backward:function(){var p=this.V_in;p.drv=c.zeros(p.data.length);var m=p.drv;var h=this.V_out.drv;var o=this.max_pos_x;var l=this.max_pos_y;var e=0;for(var j=0;j<this.out_depth;j++){for(var f=0;f<this.out_sy;f++){for(var g=0;g<this.out_sx;g++,e++){var k=p.getIndex(o[e],l[e],j);m[k]+=h[e]}}}}};c.PoolLayer=b})(mlitb);(function(b){var a=function(){this.layers=[]};a.prototype={initWeight:function(c){for(var d=0;d<c.length-1;d++){b.W.push(b.zeros(c[d].n_neuron+1,c[d+1].n_neuron,"random"))}},createLayers:function(c){for(var d=0;d<c.length;d++){if(d==0){this.layers.push(new b.InputLayer(c[d]))}else{if(d==c.length-1){this.layers.push(new b.OutputLayer(c[d]))}else{this.layers.push(new b.HiddenLayer(c[d]))}}}},forward:function(e){var c=b.W;this.layers[0].outs=b.clone(e);this.layers[0].outs.push(1);for(var d=0;d<this.layers.length-1;d++){console.log("W ");console.log(c[d]);this.layers[d+1].ins=b.dot(this.layers[d].outs,c[d]);this.layers[d+1].forward();console.log("outs ");console.log(this.layers[d+1].outs)}},backward:function(e){var c=b.W;this.der=b.zeros(b.W.length);console.log("target "+e);for(var d=this.layers.length-1;d>0;d--){this.layers[d].backward(e);this.layers[d-1].back_in=b.dot(this.layers[d].delta,c[d-1],"r");this.der[d-1]=b.dot(this.layers[d-1].outs,this.layers[d].delta,"l")}}};b.Net=a})(mlitb);(function(b){var a=function(d,c){this.net=d;this.learning_rate=typeof c.learning_rate!=="undefined"?c.learning_rate:0.01;this.k=0;this.last_gs=[]};a.prototype={train:function(c,e){this.net.forward(c);this.net.backward(e);for(var d=0;d<this.net.der.length;d++){b.W[d]=mlitb.add(b.W[d],mlitb.dot(this.net.der[d],this.learning_rate))}},checkGrad:function(d,k){this.net.forward(d);var g=[];var c=[];for(var h=0;h<b.W.length;h++){g[h]=b.clone(b.W[h])}console.log("current W");console.log(g);this.net.backward(k);var f=this.net.layers[this.net.layers.length-1].err;console.log("error");console.log(f);for(var h=0;h<b.W.length;h++){c[h]=b.clone(this.net.der[h])}console.log("derivative");console.log(c);console.log("adding epsilon to current W");var j=0.0001;b.W[0][0][0]=b.W[0][0][0]+j;this.net.forward(d);this.net.backward(k);var e=this.net.layers[this.net.layers.length-1].err;console.log("error");console.log(e);console.log("manual grad");console.log((e-f)/j)}};mlitb.SGD=a})(mlitb);var x=[0,0.05,0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8,0.85,0.9,0.95,1];x=mlitb.dot(x,Math.PI)[0];var label=(function(a){var c=[];for(var b in a){c.push(Math.sin(a[b]))}return c})(x);label=mlitb.normalize(label,0.1,0.9);x=[[0,0],[0,1],[1,0],[1,1]];y=[0,0,0,1];label=mlitb.normalize(y,0.1,0.9);console.log(x);console.log(label);var V=new mlitb.Vol(1,1,2,1);var FC=new mlitb.FullConnLayer({in_neurons:2,n_neurons:3});var FCfw=FC.forward(V);console.log(FCfw);var SIG=new mlitb.SigmoidLayer({out_sx:1,out_sy:1,out_depth:3});var SIGfw=SIG.forward(FCfw);console.log(SIGfw);SIG.V_out.data=[0.5,0.5,0.5];var target=[1,1,1];var SIGbw=SIG.backward(target);console.log(SIG.V_in);console.log(SIGbw);var FCbw=FC.backward();console.log(FC.weights);console.log(FC.V_in);var inputpool=[1,2,3,4,5,5,4,3,2,1,9,0,0,9,0,0,0,0,0,0,0,0,0,0,0,1,2,3,4,5,5,4,3,2,1,9,0,0,9,0,0,0,0,0,0,0,0,0,0,0];var Vpool=new mlitb.Vol(5,5,2);Vpool.data=inputpool;console.log(Vpool.get(0,0,0));console.log(Vpool.getIndex(1,1,1));var pool=new mlitb.PoolLayer({sx:2,in_sx:5,in_sy:5,in_depth:2,stride:1});var rp=pool.forward(Vpool);console.log(rp.data);