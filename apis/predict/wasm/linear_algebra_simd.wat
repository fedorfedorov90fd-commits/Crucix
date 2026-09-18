;; apis/predict/wasm/linear_algebra_simd.wat
;; SIMD-версия линейной алгебры
;; Использует 128-битные вектора (v128) для параллельной обработки 2×f64
;;
;; Компиляция: wat2wasm --enable-simd linear_algebra_simd.wat -o linear_algebra_simd.wasm

(module
  (memory (export "memory") 512)

  ;; dot_product_simd(aPtr, bPtr, n) → f64
  (func (export "dot_product_simd") (param $aPtr i32) (param $bPtr i32) (param $n i32) (result f64)
    (local $i i32)
    (local $acc v128)
    (local $remaining i32)
    (local $sum f64)
    (local.set $acc (v128.const f64x2 0 0))
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (local.set $acc
          (f64x2.add
            (local.get $acc)
            (f64x2.mul
              (v128.load (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8))))
              (v128.load (i32.add (local.get $bPtr) (i32.mul (local.get $i) (i32.const 8))))
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (local.set $sum
      (f64.add
        (f64x2.extract_lane 0 (local.get $acc))
        (f64x2.extract_lane 1 (local.get $acc))
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (local.set $sum
          (f64.add
            (local.get $sum)
            (f64.mul
              (f64.load (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8))))
              (f64.load (i32.add (local.get $bPtr) (i32.mul (local.get $i) (i32.const 8))))
            )
          )
        )
      )
    )
    (local.get $sum)
  )

  (func (export "l2_norm_simd") (param $xPtr i32) (param $n i32) (result f64)
    (local $i i32)
    (local $acc v128)
    (local $remaining i32)
    (local $sum f64)
    (local.set $acc (v128.const f64x2 0 0))
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (local.set $acc
          (f64x2.add
            (local.get $acc)
            (f64x2.mul
              (v128.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
              (v128.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (local.set $sum
      (f64.add
        (f64x2.extract_lane 0 (local.get $acc))
        (f64x2.extract_lane 1 (local.get $acc))
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (local.set $sum
          (f64.add
            (local.get $sum)
            (f64.mul
              (f64.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
              (f64.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
            )
          )
        )
      )
    )
    (f64.sqrt (local.get $sum))
  )

  (func (export "matrix_multiply_simd")
    (param $aPtr i32) (param $bPtr i32) (param $cPtr i32)
    (param $n i32) (param $m i32) (param $p i32)
    (local $i i32) (local $j i32) (local $k i32)
    (local $sum v128) (local $aik f64)
    (local $bOffset i32) (local $cOffset i32) (local $p2 i32)
    (local.set $p2 (i32.and (local.get $p) (i32.const -2)))
    (local.set $i (i32.const 0))
    (block $exitI
      (loop $loopI
        (br_if $exitI (i32.ge_s (local.get $i) (local.get $n)))
        (local.set $j (i32.const 0))
        (block $exitJ2
          (loop $loopJ2
            (br_if $exitJ2 (i32.ge_s (local.get $j) (local.get $p2)))
            (local.set $sum (v128.const f64x2 0 0))
            (local.set $k (i32.const 0))
            (block $exitK
              (loop $loopK
                (br_if $exitK (i32.ge_s (local.get $k) (local.get $m)))
                (local.set $aik
                  (f64.load
                    (i32.add (local.get $aPtr)
                      (i32.mul
                        (i32.add (i32.mul (local.get $i) (local.get $m)) (local.get $k))
                        (i32.const 8)
                      )
                    )
                  )
                )
                (local.set $bOffset
                  (i32.add (local.get $bPtr)
                    (i32.mul
                      (i32.add (i32.mul (local.get $k) (local.get $p)) (local.get $j))
                      (i32.const 8)
                    )
                  )
                )
                (local.set $sum
                  (f64x2.add
                    (local.get $sum)
                    (f64x2.mul
                      (f64x2.splat (local.get $aik))
                      (v128.load (local.get $bOffset))
                    )
                  )
                )
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $loopK)
              )
            )
            (local.set $cOffset
              (i32.add (local.get $cPtr)
                (i32.mul
                  (i32.add (i32.mul (local.get $i) (local.get $p)) (local.get $j))
                  (i32.const 8)
                )
              )
            )
            (v128.store (local.get $cOffset) (local.get $sum))
            (local.set $j (i32.add (local.get $j) (i32.const 2)))
            (br $loopJ2)
          )
        )
        (if (i32.lt_s (local.get $j) (local.get $p))
          (then
            (local.set $k (i32.const 0))
            (f64.store
              (i32.add (local.get $cPtr)
                (i32.mul (i32.add (i32.mul (local.get $i) (local.get $p)) (local.get $j)) (i32.const 8)))
              (f64.const 0)
            )
            (block $exitKTail
              (loop $loopKTail
                (br_if $exitKTail (i32.ge_s (local.get $k) (local.get $m)))
                (f64.store
                  (i32.add (local.get $cPtr)
                    (i32.mul (i32.add (i32.mul (local.get $i) (local.get $p)) (local.get $j)) (i32.const 8)))
                  (f64.add
                    (f64.load
                      (i32.add (local.get $cPtr)
                        (i32.mul (i32.add (i32.mul (local.get $i) (local.get $p)) (local.get $j)) (i32.const 8))))
                    (f64.mul
                      (f64.load
                        (i32.add (local.get $aPtr)
                          (i32.mul (i32.add (i32.mul (local.get $i) (local.get $m)) (local.get $k)) (i32.const 8))))
                      (f64.load
                        (i32.add (local.get $bPtr)
                          (i32.mul (i32.add (i32.mul (local.get $k) (local.get $p)) (local.get $j)) (i32.const 8))))
                    )
                  )
                )
                (local.set $k (i32.add (local.get $k) (i32.const 1)))
                (br $loopKTail)
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loopI)
      )
    )
  )

  (func (export "relu_simd_inplace") (param $xPtr i32) (param $n i32)
    (local $i i32) (local $remaining i32) (local $zero v128) (local $v v128) (local $addr i32)
    (local.set $zero (v128.const f64x2 0 0))
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (local.set $addr (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
        (local.set $v (v128.load (local.get $addr)))
        (v128.store (local.get $addr) (f64x2.max (local.get $v) (local.get $zero)))
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (local.set $addr (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
        (if (f64.lt (f64.load (local.get $addr)) (f64.const 0))
          (then (f64.store (local.get $addr) (f64.const 0)))
        )
      )
    )
  )

  (func (export "add_simd_inplace") (param $aPtr i32) (param $bPtr i32) (param $n i32)
    (local $i i32) (local $remaining i32)
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (v128.store
          (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8)))
          (f64x2.add
            (v128.load (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8))))
            (v128.load (i32.add (local.get $bPtr) (i32.mul (local.get $i) (i32.const 8))))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (f64.store
          (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8)))
          (f64.add
            (f64.load (i32.add (local.get $aPtr) (i32.mul (local.get $i) (i32.const 8))))
            (f64.load (i32.add (local.get $bPtr) (i32.mul (local.get $i) (i32.const 8))))
          )
        )
      )
    )
  )

  (func (export "scalar_multiply_simd_inplace")
    (param $xPtr i32) (param $n i32) (param $scalar f64)
    (local $i i32) (local $remaining i32) (local $scalarVec v128)
    (local.set $scalarVec (f64x2.splat (local.get $scalar)))
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (v128.store
          (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8)))
          (f64x2.mul
            (v128.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
            (local.get $scalarVec)
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (f64.store
          (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8)))
          (f64.mul
            (f64.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
            (local.get $scalar)
          )
        )
      )
    )
  )

  (func (export "max_simd") (param $xPtr i32) (param $n i32) (result f64)
    (local $i i32) (local $remaining i32) (local $maxVec v128) (local $maxScalar f64)
    (local.set $maxVec (v128.const f64x2 -1e308 -1e308))
    (local.set $i (i32.const 0))
    (local.set $remaining (local.get $n))
    (block $exit
      (loop $loop
        (br_if $exit (i32.lt_s (local.get $remaining) (i32.const 2)))
        (local.set $maxVec
          (f64x2.max
            (local.get $maxVec)
            (v128.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 2)))
        (local.set $remaining (i32.sub (local.get $remaining) (i32.const 2)))
        (br $loop)
      )
    )
    (local.set $maxScalar
      (f64.max
        (f64x2.extract_lane 0 (local.get $maxVec))
        (f64x2.extract_lane 1 (local.get $maxVec))
      )
    )
    (if (i32.eq (local.get $remaining) (i32.const 1))
      (then
        (local.set $maxScalar
          (f64.max
            (local.get $maxScalar)
            (f64.load (i32.add (local.get $xPtr) (i32.mul (local.get $i) (i32.const 8))))
          )
        )
      )
    )
    (local.get $maxScalar)
  )
)
